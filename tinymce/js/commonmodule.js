// TinyMCE recordrtc library functions.
// @package    tinymce_recordrtc.
// @author     Jesus Federico  (jesus [at] blindsidenetworks [dt] com).
// @copyright  2016 to present, Blindside Networks Inc.
// @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later.

// Scrutinizer CI directives.
/** global: M */
/** global: Y */
/** global: tinyMCEPopup */

M.tinymce_recordrtc = M.tinymce_recordrtc || {};

// Extract plugin settings to params hash.
(function() {
    var params = {};
    var r = /([^&=]+)=?([^&]*)/g;

    var d = function(s) {
        return window.decodeURIComponent(s.replace(/\+/g, ' '));
    };

    var search = window.location.search;
    var match = r.exec(search.substring(1));
    while (match) {
        params[d(match[1])] = d(match[2]);

        if (d(match[2]) === 'true' || d(match[2]) === 'false') {
            params[d(match[1])] = d(match[2]) === 'true' ? true : false;
        }
        match = r.exec(search.substring(1));
    }

    window.params = params;
})();

// Initialize some variables.
var alertWarning = null;
var alertDanger = null;
var mediaRecorder = null;
var player = null;
var playerDOM = null;
var recType = null;
var startStopBtn = null;
var uploadBtn = null;

// A helper for making a Moodle alert appear.
// Subject is the content of the alert (which error ther alert is for).
// Possibility to add on-alert-close event.
M.tinymce_recordrtc.show_alert = function(subject, onCloseEvent) {
    Y.use('moodle-core-notification-alert', function() {
        var dialogue = new M.core.alert({
            title: M.util.get_string(subject + '_title', 'tinymce_recordrtc'),
            message: M.util.get_string(subject, 'tinymce_recordrtc')
        });

        if (onCloseEvent) {
            dialogue.after('complete', onCloseEvent);
        }
    });
};

// Notify and redirect user if plugin is used from insecure location.
M.tinymce_recordrtc.check_secure = function() {
    var isSecureOrigin = (window.location.protocol === 'https:') ||
                         (window.location.host.indexOf('localhost') !== -1);

    if (!isSecureOrigin) {
        alertDanger.ancestor().ancestor().removeClass('hide');
    }
};

// Display "consider switching browsers" message if not using:
// - Firefox 29+;
// - Chrome 49+;
// - Opera 36+.
M.tinymce_recordrtc.check_browser = function() {
    if (!((window.bowser.firefox && window.bowser.version >= 29) ||
          (window.bowser.chrome && window.bowser.version >= 49) ||
          (window.bowser.opera && window.bowser.version >= 36))) {
        alertWarning.ancestor().ancestor().removeClass('hide');
    }
};

// Capture webcam/microphone stream.
M.tinymce_recordrtc.capture_user_media = function(mediaConstraints, successCallback, errorCallback) {
    window.navigator.mediaDevices.getUserMedia(mediaConstraints).then(successCallback).catch(errorCallback);
};

// Generates link to recorded annotation to be inserted.
M.tinymce_recordrtc.create_annotation = function(type, recording_url) {
    var linkText = window.prompt(M.util.get_string('annotationprompt', 'tinymce_recordrtc'),
                                 M.util.get_string('annotation:' + type, 'tinymce_recordrtc'));

    // Return HTML for annotation link, if user did not press "Cancel".
    if (!linkText) {
        return undefined;
    } else {
        var annotation = '<div><a target="_blank" href="' + recording_url + '">' + linkText + '</a></div>';
        return annotation;
    }
};

// Inserts link to annotation in editor text area.
M.tinymce_recordrtc.insert_annotation = function(type, recording_url) {
    var annotation = M.tinymce_recordrtc.create_annotation(type, recording_url);

    // Insert annotation link.
    // If user pressed "Cancel", just go back to main recording screen.
    if (!annotation) {
        uploadBtn.set('textContent', M.util.get_string('attachrecording', 'tinymce_recordrtc'));
    } else {
        tinyMCEPopup.editor.execCommand('mceInsertContent', false, annotation);
        tinyMCEPopup.close();
    }
};
