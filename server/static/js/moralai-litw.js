// Persistent network connection that will be used to transmit real-time data
var socket = io();



var config;

var tutorial_instructions = () => [
    `
    <p>Mechanic: <b>Delivery</b></p>
    <p>Your goal here is to cook and deliver soups in order to earn reward. Notice how your partner is busily churning out soups</p>
    <p>See if you can copy his actions in order to cook and deliver the appropriate soup.</p>
    <p><b>Note</b>: You must cook a soup with <b>exactly</b> 3 onions to advance.</p>
    <p>Good luck!</p>
    `,
    `
    <p>Time to see how many soups you can cook in 30 seconds.</p>
    <p>Ready? Set...</p>
    `
];

var tutorial_hints = () => [
    `
    <p>
        You can move up, down, left, and right using
        the <b>arrow keys</b>, and interact with objects
        using the <b>spacebar</b>.
      </p>
      <p>
        You can interact with objects by facing them and pressing
        <b>spacebar</b>. Here are some examples:
        <ul>
          <li>You can pick up onions by facing
            the ingredient area and pressing <b>spacebar</b>.</li>
          <li>If you are holding an ingredient, are facing an empty counter,
            and press <b>spacebar</b>, you put the ingredient on the counter.</li>
          <li>If you are holding an ingredient, are facing a pot that is not full,
            and press <b>spacebar</b>, you will put the ingredient in the pot.</li>
          <li>If you are facing a pot that is non-empty, are currently holding nothing, and 
            and press <b>spacebar</b>, you will begin cooking a soup.</li>
        </ul>
      </p>
    `,
    `
    <p>You cannot remove ingredients from the pot. You can, however, cook any soup you like...</p>
    `,
    `
    <p>Each onion is worth ${config['onion_value']} points<p>
    `
]

var curr_tutorial_phase;

// Read in game config provided by server
$(function() {
    config = JSON.parse($('#config').text());
    tutorial_instructions = tutorial_instructions();
    tutorial_hints = tutorial_hints();
    $('#quit').show();
});

/* * * * * * * * * * * * * * * * 
 * Button click event handlers *
 * * * * * * * * * * * * * * * */

$(function() {
    $('#try-again').click(function () {
        data = {
            "params" : config['litwParams'],
            "game_name" : "litw"
        };
        socket.emit("join", data);
        $('try-again').attr("disable", true);
    });
});

$(function() {
    $('#show-hint').click(function() {
        let text = $(this).text();
        let new_text = text === "Show Hint" ? "Hide Hint" : "Show Hint";
        $('#hint-wrapper').toggle();
        $(this).text(new_text);
    });
});

$(function() {
    $('#quit').click(function() {
        socket.emit("leave", {});
        $('quit').attr("disable", true);
        window.location.href = "./";
    });
});

$(function() {
    $('#finish').click(function() {
        $('finish').attr("disable", true);
        window.location.href = "./";
    });
});



/* * * * * * * * * * * * * 
 * Socket event handlers *
 * * * * * * * * * * * * */

socket.on('creation_failed', function(data) {
    // Tell user what went wrong
    let err = data['error']
    $("#overcooked").empty();
    $('#overcooked').append(`<h4>Sorry, study creation failed with error: ${JSON.stringify(err)}</>`);
    $('#try-again').show();
    $('#try-again').attr("disabled", false);
});

socket.on('start_game', function(data) {
    curr_tutorial_phase = 0;
    graphics_config = {
        container_id : "overcooked",
        start_info : data.start_info
    };
    $("#overcooked").empty();
    $('#game-over').hide();
    $('#try-again').hide();
    $('#try-again').attr('disabled', true)
    $('#hint-wrapper').hide();
    $('#show-hint').text('Show Hint');
    $('#game-title').text(`Study Progress, Phase ${curr_tutorial_phase + 1}/${tutorial_instructions.length}`);
    $('#game-title').show();
    $('#tutorial-instructions').append(tutorial_instructions[curr_tutorial_phase]);
    $('#instructions-wrapper').show();
    $('#hint').append(tutorial_hints[curr_tutorial_phase]);
    enable_key_listener();
    graphics_start(graphics_config);
});

socket.on('reset_game', function(data) {
    curr_tutorial_phase++;
    graphics_end();
    disable_key_listener();
    $("#overcooked").empty();
    $('#tutorial-instructions').empty();
    $('#hint').empty();
    $("#tutorial-instructions").append(tutorial_instructions[curr_tutorial_phase]);
    $("#hint").append(tutorial_hints[curr_tutorial_phase]);
    $('#game-title').text(`Study Progress, Phase ${curr_tutorial_phase + 1}/${tutorial_instructions.length}`);
    
    let button_pressed = $('#show-hint').text() === 'Hide Hint';
    if (button_pressed) {
        $('#show-hint').click();
    }
    graphics_config = {
        container_id : "overcooked",
        start_info : data.state
    };
    console.log(`STUDY phase #${curr_tutorial_phase}! CONFIG: ${JSON.stringify(data.state)}.`);
    graphics_start(graphics_config);
    enable_key_listener();
});

socket.on('state_pong', function(data) {
    // Draw state update
    let cur_state = data['state'];
    delete cur_state['all_orders'];
    delete cur_state['bonus_orders'];
    drawState(cur_state);
});

socket.on('end_game', function(data) {
    // Hide game data and display game-over html
    graphics_end();
    disable_key_listener();
    $('#game-title').hide();
    $('#instructions-wrapper').hide();
    $('#hint-wrapper').hide();
    $('#show-hint').hide();
    $('#game-over').show();
    $('#quit').hide();
    
    if (data.status === 'inactive') {
        // Game ended unexpectedly
        $('#error-exit').show();
        // Propogate game stats to parent window with psiturk code
        window.top.postMessage({ name : "error" }, "*");
    } else {
        // Propogate game stats to parent window with psiturk code
        window.top.postMessage({ name : "tutorial-done" }, "*");
    }

    $('#finish').show();
});


/* * * * * * * * * * * * * * 
 * Game Key Event Listener *
 * * * * * * * * * * * * * */

function enable_key_listener() {
    $(document).on('keydown', function(e) {
        let action = 'STAY'
        switch (e.which) {
            case 37: // left
                action = 'LEFT';
                break;

            case 38: // up
                action = 'UP';
                break;

            case 39: // right
                action = 'RIGHT';
                break;

            case 40: // down
                action = 'DOWN';
                break;

            case 32: //space
                action = 'SPACE';
                break;

            default: // exit this handler for other keys
                return; 
        }
        e.preventDefault();
        socket.emit('action', { 'action' : action });
    });
};

function disable_key_listener() {
    $(document).off('keydown');
};

/* * * * * * * * * * * * 
 * Game Initialization *
 * * * * * * * * * * * */

socket.on("connect", function() {
    // Config for this specific game
    let data = {
        "params" : config['litwParams'],
        "game_name" : "litw"
    };

    // create (or join if it exists) new game
    socket.emit("join", data);
});


/* * * * * * * * * * *
 * Utility Functions *
 * * * * * * * * * * */

var arrToJSON = function(arr) {
    let retval = {}
    for (let i = 0; i < arr.length; i++) {
        elem = arr[i];
        key = elem['name'];
        value = elem['value'];
        retval[key] = value;
    }
    return retval;
};