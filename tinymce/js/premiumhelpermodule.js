// TinyMCE recordrtc library functions.
// @package    tinymce_recordrtc.
// @author     Jesus Federico  (jesus [at] blindsidenetworks [dt] com).
// @copyright  2016 to present, Blindside Networks Inc.
// @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later.

// Scrutinizer CI directives.
/** global: M */
/** global: tinyMCEPopup */
/** global: mediaRecorder */
/** global: player */
/** global: startStopBtn */
/** global: uploadBtn */
/** global: recType */

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

    // If none of the mime-types are supported, fall back on browser defaults.
    var options = M.tinymce_recordrtc.best_rec_options(type);
    mediaRecorder = new window.MediaRecorder(stream, options);

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
