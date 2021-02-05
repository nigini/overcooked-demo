// Persistent network connection that will be used to transmit real-time data
let socket = io();
let config;
let curr_study_phase = 0;
let study_timeline = [];
let study_phases = ['tutorial', 'mai_left'];
let templates = {
    tutorial: {
        resource: 'static/templates/litw-tutorial.html',
        template: null
    }
};
var tutorial_instructions = () => [
    `
    <p>Time to see how many soups you can cook in 30 seconds.</p>
    <p>Ready? Set...</p>
    `
];

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

socket.on("connect", function() {
    let game_data = get_game_config();
    socket.emit("join", game_data);
});

socket.on('start_game', function(data) {
    console.log(`STARTING GAME: ${JSON.stringify(data)}`);
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
    $('#game-title').text(`Study Progress, Phase ${curr_study_phase + 1}/${tutorial_instructions.length}`);
    $('#game-title').show();
    $('#tutorial-instructions').append(tutorial_instructions[curr_study_phase]);
    $('#instructions-wrapper').show();
    enable_key_listener();
    graphics_start(graphics_config);
});

socket.on('reset_game', function(data) {
    console.log(`RESET GAME: ${JSON.stringify(data)}`);
    curr_study_phase++;
    graphics_end();
    disable_key_listener();
    $("#overcooked").empty();
    $('#tutorial-instructions').empty();
    $('#hint').empty();

    if(curr_study_phase < study_phases.length) {
        $("#tutorial-instructions").append(tutorial_instructions[curr_study_phase]);
        $("#hint").append(tutorial_hints[curr_study_phase]);
        $('#game-title').text(`Study Progress, Phase ${curr_study_phase + 1}/${tutorial_instructions.length}`);
        let button_pressed = $('#show-hint').text() === 'Hide Hint';
        if (button_pressed) {
            $('#show-hint').click();
        }
        let game_config = get_game_config();
        socket.emit("join", game_config);
    } else {
        end_study(data)
    }
});

socket.on('state_pong', function(data) {
    let cur_state = data['state'];
    delete cur_state['all_orders'];
    delete cur_state['bonus_orders'];
    drawState(cur_state);
});

socket.on('end_game', function (data){
    end_study(data);
});

function start_study(){
    $.i18n().locale = LITW.locale.getLocale();
    $.i18n().load({
        'en': 'static/templates/i18n/en.json',
    }).done(function(){
        $('head').i18n();
        console.log($.i18n('litw-study-title'));
        $('body').i18n();
    });

    const async_load = async (template_names) => {
        const promises = template_names.map(load_template);
        await Promise.all(promises);
        console.log('TEMPLATES: '+ JSON.stringify(templates));
    };

    let template_names = Object.keys(templates);
    async_load(template_names).then( function(){
        configure_study();
        jsPsych.init({
            timeline: study_timeline
        });
    });
}

function load_template(template_name) {
    return $.get(templates[template_name].resource, function(html){
        templates[template_name].template = Handlebars.compile(html);
        console.log(`LOADED ${JSON.stringify(templates[template_name].template)}`);
    })
}

function configure_study() {
    study_timeline.push({
        name: "tutorial",
        type: "display-slide",
        template: templates.tutorial.template,
        display_element: $("#tutorial"),
        show_next: false
    });
}

function end_study(data) {
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
}

function get_game_config() {
    let game_config = null;
    if(curr_study_phase < study_phases.length){
        let stored_config = config[study_phases[curr_study_phase]];
        let game_name = stored_config['game_name'];
        delete stored_config['game_name'];
        game_config = {
            "params": stored_config,
            "game_name": game_name
        }
    }
    return game_config;
}


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

$(function() {
    config = JSON.parse($('#config').text());
    start_study();
})