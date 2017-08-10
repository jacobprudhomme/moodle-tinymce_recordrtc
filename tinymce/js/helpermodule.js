// TinyMCE recordrtc library functions.
// @package    tinymce_recordrtc.
// @author     Jesus Federico  (jesus [at] blindsidenetworks [dt] com).
// @copyright  2016 to present, Blindside Networks Inc.
// @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later.

// Scrutinizer CI directives.
/** global: M */
/** global: Y */

M.tinymce_recordrtc = M.tinymce_recordrtc || {};

// Initialize some variables.
var blobSize = null;
var chunks = null;
var countdownSeconds = null;
var countdownTicker = null;
var maxUploadSize = null;

// Add chunks of audio/video to array when made available.
M.tinymce_recordrtc.handle_data_available = function(event) {
    // Size of all recorded data so far.
    blobSize += event.data.size;

    // Push recording slice to array.
    // If total size of recording so far exceeds max upload limit, stop recording.
    // An extra condition exists to avoid displaying alert twice.
    if ((blobSize >= maxUploadSize) && (!window.localStorage.getItem('alerted'))) {
        window.localStorage.setItem('alerted', 'true');

        Y.use('node-event-simulate', function() {
            startStopBtn.simulate('click');
        });
        M.tinymce_recordrtc.show_alert('nearingmaxsize');
    } else if ((blobSize >= maxUploadSize) && (window.localStorage.getItem('alerted') === 'true')) {
        window.localStorage.removeItem('alerted');
    } else {
        chunks.push(event.data);
    }
};

// Handle recording end.
M.tinymce_recordrtc.handle_stop = function() {
    // Set source of audio player.
    var blob = new window.Blob(chunks, {type: mediaRecorder.mimeType});
    player.set('src', window.URL.createObjectURL(blob));

    // Show audio player with controls enabled, and unmute.
    player.set('muted', false);
    player.set('controls', true);
    player.ancestor().ancestor().removeClass('hide'); // AUDIO ONLY

    // Show upload button.
    uploadBtn.set('disabled', false);
    uploadBtn.set('textContent', M.util.get_string('attachrecording', 'tinymce_recordrtc'));
    uploadBtn.ancestor().ancestor().removeClass('hide');

    // Handle when upload button is clicked.
    uploadBtn.on('click', function() {
        // Trigger error if no recording has been made.
        if (!player.get('src') || chunks === []) {
            M.tinymce_recordrtc.show_alert('norecordingfound');
        } else {
            uploadBtn.set('disabled', true);

            // Upload recording to server.
            M.tinymce_recordrtc.upload_to_server(recType, function(progress, fileURLOrError) {
                if (progress === 'ended') { // Insert annotation in text.
                    uploadBtn.set('disabled', false);
                    M.tinymce_recordrtc.insert_annotation(recType, fileURLOrError);
                } else if (progress === 'upload-failed') { // Show error message in upload button.
                    uploadBtn.set('disabled', false);
                    uploadBtn.set('textContent', M.util.get_string('uploadfailed', 'tinymce_recordrtc') + ' ' + fileURLOrError);
                } else if (progress === 'upload-failed-404') { // 404 error = File too large in Moodle.
                    uploadBtn.set('disabled', false);
                    uploadBtn.set('textContent', M.util.get_string('uploadfailed404', 'tinymce_recordrtc'));
                } else if (progress === 'upload-aborted') {
                    uploadBtn.set('disabled', false);
                    uploadBtn.set('textContent', M.util.get_string('uploadaborted', 'tinymce_recordrtc') + ' ' + fileURLOrError);
                } else {
                    uploadBtn.set('textContent', progress);
                }
            });
        }
    });
};

// Get everything set up to start recording.
M.tinymce_recordrtc.start_recording = function(type, stream) {
    // The options for the recording codecs and bitrates.
    var options = null;
    if (type === 'audio') {
        if (window.MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = {
                audioBitsPerSecond: window.params.audiobitrate,
                mimeType: 'audio/webm;codecs=opus'
            };
        } else if (window.MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            options = {
                audioBitsPerSecond: window.params.audiobitrate,
                mimeType: 'audio/ogg;codecs=opus'
            };
        }
    } else {
        if (window.MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            options = {
                audioBitsPerSecond: window.params.audiobitrate,
                videoBitsPerSecond: window.params.videobitrate,
                mimeType: 'video/webm;codecs=vp9,opus'
            };
        } else if (window.MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
            options = {
                audioBitsPerSecond: window.params.audiobitrate,
                videoBitsPerSecond: window.params.videobitrate,
                mimeType: 'video/webm;codecs=h264,opus'
            };
        } else if (window.MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            options = {
                audioBitsPerSecond: window.params.audiobitrate,
                videoBitsPerSecond: window.params.videobitrate,
                mimeType: 'video/webm;codecs=vp8,opus'
            };
        }
    }

    // If none of the options above are supported, fall back on browser defaults.
    mediaRecorder = options ? new window.MediaRecorder(stream, options)
                            : new window.MediaRecorder(stream);

    // Initialize MediaRecorder events and start recording.
    mediaRecorder.ondataavailable = M.tinymce_recordrtc.handle_data_available;
    mediaRecorder.onstop = M.tinymce_recordrtc.handle_stop;
    mediaRecorder.start(1000); // Capture in 1s chunks. Must be set to work with Firefox.

    // Mute audio, distracting while recording.
    player.set('muted', true);

    // Set recording timer to the time specified in the settings.
    countdownSeconds = window.params.timelimit;
    countdownSeconds++;
    var timerText = M.util.get_string('stoprecording', 'tinymce_recordrtc');
    timerText += ' (<span id="minutes"></span>:<span id="seconds"></span>)';
    startStopBtn.setHTML(timerText);
    M.tinymce_recordrtc.set_time();
    countdownTicker = window.setInterval(M.tinymce_recordrtc.set_time, 1000);

    // Make button clickable again, to allow stopping recording.
    startStopBtn.set('disabled', false);
};

// Upload recorded audio/video to server.
M.tinymce_recordrtc.upload_to_server = function(type, callback) {
    var xhr = new window.XMLHttpRequest();

    // Get src media of audio/video tag.
    xhr.open('GET', player.get('src'), true);
    xhr.responseType = 'blob';

    xhr.onload = function() {
        if (xhr.status === 200) { // If src media was successfully retrieved.
            // blob is now the media that the audio/video tag's src pointed to.
            var blob = this.response;

            // Generate filename with random ID and file extension.
            var fileName = (Math.random() * 1000).toString().replace('.', '');
            if (type === 'audio') {
                fileName += '-audio.ogg';
            } else {
                fileName += '-video.webm';
            }

            // Create FormData to send to PHP upload/save script.
            var formData = new window.FormData();
            formData.append('contextid', window.params.contextid);
            formData.append('sesskey', window.params.sesskey);
            formData.append(type + '-filename', fileName);
            formData.append(type + '-blob', blob);

            // Pass FormData to PHP script using XHR.
            M.tinymce_recordrtc.make_xmlhttprequest('save.php', formData, function(progress, responseText) {
                if (progress === 'upload-ended') {
                    var initialURL = location.href.replace(location.href.split('/').pop(), '') + 'uploads.php/';
                    callback('ended', initialURL + responseText);
                } else {
                    callback(progress);
                }
            });
        }
    };

    xhr.send();
};

// Handle XHR sending/receiving/status.
M.tinymce_recordrtc.make_xmlhttprequest = function(url, data, callback) {
    var xhr = new window.XMLHttpRequest();

    xhr.onreadystatechange = function() {
        if ((xhr.readyState === 4) && (xhr.status === 200)) { // When request is finished and successful.
            callback('upload-ended', xhr.responseText);
        } else if (xhr.status === 404) { // When request returns 404 Not Found.
            callback('upload-failed-404');
        }
    };

    xhr.upload.onprogress = function(event) {
        callback(Math.round(event.loaded / event.total * 100) + "% " + M.util.get_string('uploadprogress', 'tinymce_recordrtc'));
    };

    xhr.upload.onerror = function(error) {
        callback('upload-failed', error);
    };

    xhr.upload.onabort = function(error) {
        callback('upload-aborted', error);
    };

    // POST FormData to PHP script that handles uploading/saving.
    xhr.open('POST', url);
    xhr.send(data);
};

// Makes 1min and 2s display as 1:02 on timer instead of 1:2, for example.
M.tinymce_recordrtc.pad = function(val) {
    var valString = val + "";

    if (valString.length < 2) {
        return "0" + valString;
    } else {
        return valString;
    }
};

// Functionality to make recording timer count down.
// Also makes recording stop when time limit is hit.
M.tinymce_recordrtc.set_time = function() {
    countdownSeconds--;

    startStopBtn.one('span#seconds').set('textContent', M.tinymce_recordrtc.pad(countdownSeconds % 60));
    startStopBtn.one('span#minutes').set('textContent', M.tinymce_recordrtc.pad(window.parseInt(countdownSeconds / 60, 10)));

    if (countdownSeconds === 0) {
        Y.use('node-event-simulate', function() {
            startStopBtn.simulate('click');
        });
    }
};
