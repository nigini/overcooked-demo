// Persistent network connection that will be used to transmit real-time data
let socket = io();

// MAKE SURE that that "playerOne" is always the BOT!
let games_config = {
    "tutorial": {
        "game_name" : "litw_tutorial",
        "layouts" : ["tutorial_0"],
        "playerZero" : "human",
        "playerOne" : "TutorialAI",
        "mdp_params" : {
            "delivery_reward" : 10,
        }
    },
    "tutorial_coop": {
        "game_name" : "litw_tutorial_coop",
        "layouts" : ["tutorial_0_coop"],
        "playerZero" : "human",
        "playerOne" : "TutorialAI",
        "mdp_params" : {
            "delivery_reward" : 10,
        }
    },
    "mai_left": {
        "game_name" : "litw_cook",
        "layouts" : ["mai_separate_coop_left"],
        "playerZero" : "human",
        "playerOne" : "right_coop",
        "gameTime" : 60,
        "mdp_params" : {
            "delivery_reward" : 10,
        }
    },
    "mai_right": {
        "game_name" : "litw_cook",
        "layouts" : ["mai_separate_coop_right"],
        "playerZero" : "human",
        "playerOne" : "left_coop",
        "gameTime" : 60,
        "mdp_params" : {
            "delivery_reward" : 10,
        }
    },
};
let study_timeline = [];
let templates = {
    tutorial1: {
        resource: 'static/templates/litw-tutorial-step1.html',
        template: null
    },
    tutorial2: {
        resource: 'static/templates/litw-tutorial-step2.html',
        template: null
    },
    tutorial3: {
        resource: 'static/templates/litw-tutorial-step3.html',
        template: null
    },
    rounds_inst: {
        resource: 'static/templates/litw-round-instructions.html',
        template: null
    },
    rounds: {
        resource: 'static/templates/litw-round.html',
        template: null
    }
};
let study_data = {};


/* Socket event handlers */
socket.on('creation_failed', function(data) {
    // Tell user what went wrong
    let err = data['error']
    $("#overcooked").empty();
    $('#overcooked').append(`<h4>Sorry, study creation failed with error: ${JSON.stringify(err)}</>`);
    $('#try-again').show();
    $('#try-again').attr("disabled", false);
});

socket.on("connect", function() {
    console.log("SOCKET CONNECTED!");
});

socket.on('start_game', function(data) {
    console.log(`STARTING GAME: ${JSON.stringify(data)}`);
    graphics_config = {
        container_id : "overcooked",
        start_info : data.start_info
    };
    enable_key_listener();
    graphics_start(graphics_config);
});

socket.on('reset_game', function(data) {
    let game_data = data.data;
    graphics_end();
    disable_key_listener();
    let size = study_data.games.length;
    if(size>0) {
        study_data.games[size-1].data = game_data;
    }
    jsPsych.finishTrial();
});

socket.on('state_pong', function(data) {
    let cur_state = data['state'];
    delete cur_state['all_orders'];
    delete cur_state['bonus_orders'];
    drawState(cur_state);
});

socket.on('end_game', function (data){
    end_game(data);
});

function start_game(game_name) {
    let game_config = get_game_config(game_name);
    console.log("STARTING GAME: " + JSON.stringify(game_config));
    socket.emit("join", game_config);
}

function get_game_config(config_name) {
    let game_config = null;
    if(config_name in games_config){
        let stored_config = JSON.parse(JSON.stringify(games_config[config_name]));
        let game_name = stored_config['game_name'];
        delete stored_config['game_name'];
        stored_config.litw_uuid = LITW.data.getParticipantId();
        game_config = {
            "params": stored_config,
            "game_name": game_name
        }
    }
    return game_config;
}

function end_game(data) {
    // Hide game data and display game-over html
    graphics_end();
    disable_key_listener();
    console.log("END_STUDY: " + JSON.stringify(data));
}


/* Game Key Event Listener */

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


/* LITW STUDY CONFIGURATION */

function _init_litw(){
    LITW.data.initialize().then( function () {
        study_data.litw_uuid = LITW.data.getParticipantId();
        study_data.country = LITW.data.getCountry();
        study_data.city = LITW.data.getCity();
    });
    study_data.locale = LITW.locale.getLocale();
    study_data.games = [];
}

function start_study(){
    _init_litw();

    const async_load = async (template_names) => {
        const promises = template_names.map(load_template);
        await Promise.all(promises);
    };

    $.i18n().locale = study_data.locale;
    $.i18n().load({
        'en': 'static/templates/i18n/en.json',
    }).done(function(){
        $('head').i18n();
        console.log($.i18n('litw-study-title'));
        $('body').i18n();
        let template_names = Object.keys(templates);
        async_load(template_names).then( function(){
            configure_study();
            jsPsych.init({
                timeline: study_timeline
            });
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
    // study_timeline.push({
    //     name: "tutorial1",
    //     type: "display-slide",
    //     template: templates.tutorial1.template,
    //     display_element: $("#tutorial"),
    //     show_next: true
    // });
    // study_timeline.push({
    //     name: "tutorial2",
    //     type: "display-slide",
    //     template: templates.tutorial2.template,
    //     display_element: $("#tutorial"),
    //     show_next: false,
    //     setup: function (){
    //         start_game('tutorial');
    //     }
    // });
    // study_timeline.push({
    //     name: "tutorial3",
    //     type: "display-slide",
    //     template: templates.tutorial3.template,
    //     display_element: $("#tutorial"),
    //     show_next: false,
    //     setup: function (){
    //         start_game('tutorial_coop');
    //     }
    // });
    study_timeline.push({
        name: "round1-instructions",
        type: "display-slide",
        display_element: $("#round-instructions"),
        show_next: true,
        template: templates.rounds_inst.template,
        template_data: {
            'header': $.i18n('litw-round-1-inst-header'),
            'instructions':[
                $.i18n('litw-round-1-inst-p1'),
                $.i18n('litw-round-1-inst-p2'),
                $.i18n('litw-round-1-inst-p3'),
                $.i18n('litw-round-1-inst-p4')
            ],
            'image': '/static/images/rounds/round-layout1.png'
        }
    });
    study_timeline.push({
        name: "round1",
        type: "display-slide",
        display_element: $("#round-game"),
        show_next: false,
        template: templates.rounds.template,
        template_data: {
            'header': $.i18n('litw-round-1-header')
        },
        setup: function (){
            study_data.games.push({name: 'round1'});
            start_game('mai_left');
        },

    });

    let privileged = Math.random() >= .5;
    study_data.privileged = privileged;
    let priv_instruction_key = 'litw-round-2-inst-p2-priv';
    let round_2_conf = 'mai_left';
    if(!privileged) {
        priv_instruction_key = 'litw-round-2-inst-p2-npriv';
        round_2_conf = 'mai_right';
    }

    study_timeline.push({
        name: "round2-instructions",
        type: "display-slide",
        display_element: $("#round-instructions"),
        show_next: true,
        template: templates.rounds_inst.template,
        template_data: {
            'header': $.i18n('litw-round-2-inst-header'),
            'instructions':[
                $.i18n('litw-round-2-inst-p1'),
                $.i18n(priv_instruction_key),
                $.i18n('litw-round-2-inst-p3'),
                $.i18n('litw-round-2-inst-p4')
            ],
            'image': '/static/images/rounds/round-layout1.png'
        }
    });
    study_timeline.push({
        name: "round2",
        type: "display-slide",
        display_element: $("#round-game"),
        show_next: false,
        template: templates.rounds.template,
        template_data: {
            'header': $.i18n('litw-round-2-header')
        },
        setup: function (){
            study_data.games.push({name: 'round2'});
            start_game(round_2_conf);
        }
    });
    study_timeline.push({
        name: "round3-instructions",
        type: "display-slide",
        display_element: $("#round-instructions"),
        show_next: true,
        template: templates.rounds_inst.template,
        template_data: {
            'header': $.i18n('litw-round-3-inst-header'),
            'instructions':[
                $.i18n('litw-round-3-inst-p1'),
                $.i18n('litw-round-3-inst-p2'),
                $.i18n('litw-round-3-inst-p3'),
                $.i18n('litw-round-3-inst-p4')
            ],
            'image': '/static/images/rounds/round-layout1.png'
        }
    });
    study_timeline.push({
        name: "round3",
        type: "display-slide",
        display_element: $("#round-game"),
        show_next: false,
        template: templates.rounds.template,
        template_data: {
            'header': $.i18n('litw-round-3-header')
        },
        setup: function (){
            study_data.games.push({name: 'round3'});
            start_game('mai_left');
        }
    });
    study_timeline.push({
        name: "download-data",
        type: "call-function",
        func: function(){
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(study_data));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "study_data.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    });
}

$(function() {
    start_study();
})