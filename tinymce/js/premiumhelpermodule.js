// TinyMCE recordrtc library functions.
// @package    tinymce_recordrtc.
// @author     Jesus Federico  (jesus [at] blindsidenetworks [dt] com).
// @copyright  2016 to present, Blindside Networks Inc.
// @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later.

// Scrutinizer CI directives.
/** global: M */
/** global: tinyMCEPopup */

M.tinymce_recordrtc = M.tinymce_recordrtc || {};

// Initialize some variables.
var socket = null;

// Attempt to connect to the premium server via Socket.io.
M.tinymce_recordrtc.init_connection = function() {
    // Dialogue-closing behaviour.
    var closeDialogue = function() {
        tinyMCEPopup.close();
    };

    socket.connect();

    socket.on('connect', function() {
        // Send key and secret from Moodle settings.
        socket.emit('authentication', {
            key: window.params.apikey,
            secret: window.params.apisecret
        });

        socket.on('authenticated', function() {
            // Continue as normal.
        });

        socket.on('unauthorized', function(err) {
            M.tinymce_recordrtc.show_alert('notpremium', closeDialogue);
        });
    });

    socket.on('connect_error', function() {
        socket.disconnect();

        M.tinymce_recordrtc.show_alert('servernotfound', closeDialogue);
    });
};

// Push chunks of audio/video to server when made available.
M.tinymce_recordrtc.handle_data_available = function(event) {
    socket.emit('data available', event.data);
};

// Handle recording end.
M.tinymce_recordrtc.handle_stop = function(event) {
    startStopBtn.set('textContent', 'Start Recording');

    socket.emit('recording stopped');

    socket.on('save finished', function(path) {
        player.set('src', path);
        player.set('controls', true);
        player.set('muted', false);
        player.ancestor().ancestor().removeClass('hide'); // Only audio player is hidden at this point.

        // Show upload button.
        uploadBtn.set('disabled', false);
        uploadBtn.set('textContent', M.util.get_string('attachrecording', 'tinymce_recordrtc'));
        uploadBtn.ancestor().ancestor().removeClass('hide');

        // Handle when upload button is clicked.
        uploadBtn.on('click', function() {
            // Trigger error if no recording has been made.
            if (!player.get('src')) {
                M.tinymce_recordrtc.show_alert('norecordingfound');
            } else {
                uploadBtn.set('disabled', true);

                M.tinymce_recordrtc.insert_annotation(recType, player.get('src'));
            }
        });
    });
};

// Get everything set up to start recording.
M.tinymce_recordrtc.start_recording = function(type, stream) {
    // Generate filename with random ID and file extension.
    var fileName = (Math.random() * 1000).toString().replace('.', '');
    if (type === 'audio') {
        fileName += '-audio.ogg';
    } else {
        fileName += '-video.webm';
    }

    var data = {
        contextid: window.params.contextid,
        type: recType,
        itemid: window.params.sesskey, // Use session key as item ID.
        filename: fileName
    };
    socket.emit('recording started', data);

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

    socket.on('recording started', function() {
        // Make button clickable again, to allow stopping recording.
        startStopBtn.set('textContent', M.util.get_string('stoprecording', 'tinymce_recordrtc'));
        startStopBtn.set('disabled', false);

        // Mute audio, distracting while recording.
        player.set('muted', true);

        mediaRecorder.ondataavailable = M.tinymce_recordrtc.handle_data_available;
        mediaRecorder.onstop = M.tinymce_recordrtc.handle_stop;
        mediaRecorder.start(1500); // Capture in 1.5s chunks.
    });
};
