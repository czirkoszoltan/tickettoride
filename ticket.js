document.addEventListener("DOMContentLoaded", function() {
    var PLAYER_TYPE_NORMAL = 'normal';
    var PLAYER_TYPE_NEUTRAL = 'neutral';

    var STATE_SELECT_MAP = 0;
    var STATE_FIRST_STEP = 1;
    var STATE_SELECT_TICKETS = 2;
    var STATE_PLAY_GAME = 3;
    var STATE_SELECT_NEIGHBOR_TICKETS = 4;

    var maps = [
        {
            name: 'EU',
            allcars: 45,
            stations: 3,
            filename: 'map-eu.json?v2',
            emoji: '🚂'
        },
        {
            name: 'NL',
            allcars: 45,
            stations: 3,
            filename: 'map-nl.json?v2',
            emoji: '🌷'
        },
        {
            name: 'AMS',
            allcars: 16,
            stations: 0,
            filename: 'map-ams.json?v1',
            emoji: '🚲'
        },
        {
            name: 'USA',
            allcars: 45,
            stations: 3,
            filename: 'map-usa.json?v1',
            emoji: '🗽'
        }
    ];

    var audio = [
        querySelector('#steamwhistle'),
        querySelector('#steamwhistle2'),
    ];

    /** @type {number} */
    var gamestate_version = 5;

    var gamestate = {
        /** @var {number} */
        version: gamestate_version,

        state: STATE_SELECT_MAP,

        /** @var {string} GAMETYPE_NORMAL | GAMETYPE_NEUTRAL */
        player_type: "",

        /** @var {string} */
        mapname: "",

        /** @var {number} */
        allcars: 0,

        /** @var {number} */
        stations: 0,
        
        /*
         * [
         *     {
         *      "from": "Edinburgh",
         *      "to": "London",
         *      "length": 4,
         *      "color": "fekete",
         *      "joker": 0,
         *      "tunnel": false
         *     },
         *     ...
         * ]
         */
        routes: [],

        /* [
         *      {
         *          route: "Edinburgh - London",
         *          keep: null | 0 | 1
         *      }
         * ]
         */
        new_tickets: [],

        /*
         * [ "Edinburgh - London", ... ]
         */
        neutral_player_strategy: [],

        /* [
         *      {
         *          route: "Edinburgh - London",
         *          built: 0 (not built) | 1 (built) | 2 (station)
         *      }
         * ]
         */
        to_build: [],
    };
    
    /** @type {string[]} Array of city names, sorted alphabetically */
    var cities = [];

    /** @type {string[]} Array of routes like "Edinburgh – London", sorted alphabetically */
    var neighbors = [];

    /** @type {string[]} Array of neighbors like "Edinburgh – London" sorted alphabetically - only if multiple edges exist between the two cities */
    var double_neighbors = [];

    /* Graph of the map. Array of cities, index is city idx (see cities array).
     * Array elements are edges. Edges are objects like
     * {dest: 4 (index to cities array), len: 3 (length of edge)}.
     * Contains both directions, like Edinburgh -> London and London -> Edinburgh. */
    var map = [];

    init();

    function init() {
        window.onerror = function(message, source, lineno, colno, error) {
            alert(message);
        };
        window.tickettoride_debug = function() {
            return gamestate;
        };
        draw();
    }

    /* Persistence *************************************************************************/
    
    function save_to_localstorage() {
        window.localStorage.setItem('state', JSON.stringify(gamestate));
    }
    
    function load_from_localstorage() {
        var json = window.localStorage.getItem('state');
        if (!json) {
            alert("No saved state");
            return;
        }
        var decoded_state = JSON.parse(json);
        if (typeof decoded_state !== 'object') {
            alert("Saved state is invalid");
            return;
        }
        if (decoded_state.version !== gamestate_version) {
            alert("Saved state version is too old");
            return;
        }

        gamestate = decoded_state;
        create_data_structures();
        draw();
    }

    /* Browser ***********************************************************************/

    function forEach(collection, func) {
        for (var idx = 0; idx < collection.length; ++idx) {
            func(collection[idx], idx);
        }
    }

    function querySelector(selector) {
        return document.querySelector(selector);
    }

    function querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    function addEventListener(selector_or_element, event, func) {
        var elements;
        if (typeof selector_or_element == 'string')
            elements = querySelectorAll(selector_or_element);
        else
            elements = [selector_or_element];
        forEach(elements, function(element) {
            element.addEventListener(event, func);
        });
    }

    function getTemplate(selector) {
        return querySelector(selector).innerHTML;
    }

    function setHtml(selector, html) {
        forEach(querySelectorAll(selector), function(element) {
            element.innerHTML = html;
        });
    }

    /* User interface *****************************************************************/

    function draw() {
        switch (gamestate.state) {
            case STATE_SELECT_MAP:
                var html = Mustache.render(getTemplate('#screen-select-map'), {maps: maps});
                setHtml('#screen', html);
                break;

            case STATE_FIRST_STEP:
                var html = Mustache.render(getTemplate('#screen-first-step'), {mapname: gamestate.mapname});
                setHtml('#screen', html);
                break;

            case STATE_SELECT_TICKETS:
                var html = Mustache.render(getTemplate('#screen-select-tickets'), gamestate);
                setHtml('#screen', html);
                break;

            case STATE_PLAY_GAME:
                var html = Mustache.render(getTemplate('#screen-play-game'), gamestate);
                setHtml('#screen', html);
                break;

            case STATE_SELECT_NEIGHBOR_TICKETS:
                var html = Mustache.render(getTemplate('#screen-neighbor-tickets'), gamestate);
                setHtml('#screen', html);
                break;
        }

        addEventListener('#load-from-localstorage', 'click', load_from_localstorage.bind(null));
        forEach(querySelectorAll('.load-map-button'), function(element, index) {
            addEventListener(element, 'click', event_load_map.bind(null, maps[index]));
        });
        addEventListener('#new-tickets-button', 'click', event_new_tickets.bind(null));
        addEventListener('#new-neighbor-ticket-button', 'click', event_new_neighbor_ticket.bind(null));
        addEventListener('#accept-tickets-button', 'click', event_accept_tickets.bind(null));
        forEach(querySelectorAll('.ticket-new'), function(element, index) {
            addEventListener(element, 'click', event_new_ticket_click.bind(null, index));
        });
        forEach(querySelectorAll('.ticket-build'), function(element, index) {
            addEventListener(element, 'click', event_build_ticket_click.bind(null, index));
        });
    }

    function event_load_map(mapinfo) {
        function reqListener() {
            try {
                var routes = JSON.parse(this.responseText);
            } catch (e) {
                alert("Cannot load " + mapinfo.filename);
                return;
            }
            if (!(routes instanceof Array)) {
                alert("Invalid file from " + mapinfo.filename);
                return;
            }

            gamestate.routes = routes;
            gamestate.mapname = mapinfo.name;
            gamestate.allcars = mapinfo.allcars;
            gamestate.stations = mapinfo.stations;

            create_data_structures();

            gamestate.state = STATE_FIRST_STEP;
            // do not save state yet, there is no useful data
            draw();
        }

        var oReq = new XMLHttpRequest();
        oReq.addEventListener('load', reqListener);
        oReq.open('GET', mapinfo.filename);
        oReq.send();
    }

    function event_new_tickets() {
        var avoid = get_to_build_route_names().concat(neighbors);
        var new_tickets = random_different_from_generator(random_city_pair, 3, avoid);
        gamestate.new_tickets = [];
        forEach(new_tickets, function(route) {
            gamestate.new_tickets.push({
                route: route,
                distance: city_pair_distance(route),
                keep: null
            })
        });

        gamestate.state = STATE_SELECT_TICKETS;
        gamestate.player_type = PLAYER_TYPE_NORMAL;
        save_to_localstorage();
        draw();
    }

    function event_new_ticket_click(index) {
        gamestate.new_tickets[index].keep = gamestate.new_tickets[index].keep ? 0 : 1;

        draw();
    }

    function event_accept_tickets() {
        var kept_count = 0;
        forEach(gamestate.new_tickets, function(ticket) {
            if (ticket.keep) {
                kept_count += 1;
            }
        });
        if (kept_count < 1) {
            alert("You have to keep at least one ticket.");
            return;
        }

        forEach(gamestate.new_tickets, function(ticket) {
            if (ticket.keep) {
                gamestate.to_build.push({
                    route: ticket.route,
                    distance: ticket.distance,
                    built: 0
                });
                kept_count += 1;
            }
        });
        gamestate.new_tickets = [];

        gamestate.state = STATE_PLAY_GAME;
        save_to_localstorage();
        draw();
    }

    function event_build_ticket_click(index) {
        switch (gamestate.player_type) {
            case PLAYER_TYPE_NORMAL:
                gamestate.to_build[index].built = gamestate.to_build[index].built ? 0 : 1;
                break;
            case PLAYER_TYPE_NEUTRAL:
                gamestate.to_build[index].built = (gamestate.to_build[index].built + 1) % 3;
                break;
        }
        if (gamestate.to_build[index].built) {
            var idx = Math.floor((Math.random() * audio.length));
            audio[idx].play();
        }

        save_to_localstorage();
        draw();
    }

    function event_new_neighbor_ticket() {
        /* build strategy: randomized order. */
        if (gamestate.neutral_player_strategy.length === 0)
            gamestate.neutral_player_strategy = neutral_player_strategy_random();

        var used_cars = get_built_route_length();
        var used_stations = get_built_stations_count();
        var carsleft = gamestate.allcars - used_cars;
        var stationsleft = gamestate.stations - used_stations;

        if (carsleft < 0) {
            alert("Fix your administration, you cannot have " + used_cars + " cars.");
            return;
        }
        if (stationsleft < 0) {
            alert("Fix your administration, you cannot have " + used_stations + " stations.");
            return;
        }
        if (used_cars === gamestate.allcars && used_stations === gamestate.stations) {
            alert("You have no train cars and no stations left.");
            return;
        }
        if (gamestate.to_build.length > 0 && Math.random() < 0.2) {
            alert("No ticket for this turn 😞");
            return;
        }

        /** @return boolean */
        function can_build(route) {
            return neighbor_pair_distance(route) <= carsleft || stationsleft > 0;
        }

        /* find next route that can be built. remove selected route from strategy. */
        var i = 0;
        while (i < gamestate.neutral_player_strategy.length && !can_build(gamestate.neutral_player_strategy[i]))
            i += 1;
        if (i === gamestate.neutral_player_strategy.length)
            throw "Could not find a route to build";
        var route = gamestate.neutral_player_strategy[i];
        gamestate.neutral_player_strategy.splice(i, 1);

        gamestate.to_build.push({
            route: route,
            distance: city_pair_distance(route),
            built: 1
        });

        gamestate.state = STATE_SELECT_NEIGHBOR_TICKETS;
        gamestate.player_type = PLAYER_TYPE_NEUTRAL;
        save_to_localstorage();
        draw();
    }




    /* Utility ***********************************************************/

    function city_pair_to_string(from, to) {
        // always alphabetically, so there is no "Amsterdam - London" and "London - Amsterdam" ticket
        if (from > to) {
            var temp = from;
            from = to;
            to = temp;
        }
        return from + " – " + to;
    }

    function string_to_city_pair(pair) {
        var center = pair.indexOf("–");
        var from = pair.substr(0, center).trim();
        var to = pair.substr(center + 1).trim();
        return [from, to];
    }

    /* Data structures *******************************************/

    function create_data_structures() {
        cities = create_cities();
        neighbors = create_neighbors();
        double_neighbors = create_double_neighbors();
        map = create_map();
    }

    /** @return Array<string> */
    function get_to_build_route_names() {
        var routes = [];
        forEach(gamestate.to_build, function(route) {
            routes.push(route.route);
        });
        return routes;
    }

    /** @return number */
    function get_built_route_length() {
        var length = 0;
        forEach(gamestate.to_build, function(route) {
            if (route.built === 1)
                length += route.distance;
        });
        return length;
    }

    /** @return number */
    function get_built_stations_count() {
        var count = 0;
        forEach(gamestate.to_build, function(route) {
            if (route.built === 2)
                count += 1;
        });
        return count;
    }

    /** @return Array<string> */
    function create_cities() {
        var cities = [];

        for (var i = 0; i < gamestate.routes.length; ++i) {
            var route = gamestate.routes[i];
            if (cities.indexOf(route.from) === -1)
                cities.push(route.from);
            if (cities.indexOf(route.to) === -1)
                cities.push(route.to);
        }
        cities.sort();

        return cities;
    }

    /** @return string[] */
    function create_neighbors() {
        var neighbors = [];

        for (var i = 0; i < gamestate.routes.length; ++i) {
            var route = gamestate.routes[i];
            var pair_str = city_pair_to_string(route.from, route.to);
            if (neighbors.indexOf(pair_str) === -1)
                neighbors.push(pair_str);
        }

        return neighbors;
    }

    /** @return string[] */
    function create_double_neighbors() {
        var double_neighbors = [];

        var neighbors = {};
        for (var i = 0; i < gamestate.routes.length; ++i) {
            var route = gamestate.routes[i];
            var pair_str = city_pair_to_string(route.from, route.to);
            neighbors[pair_str] = (neighbors[pair_str] || 0) + 1;
            if (neighbors[pair_str] === 2)
                double_neighbors.push(pair_str);
        }

        return double_neighbors;
    }

    function create_map() {
        var map = [];
        for (var i = 0; i < cities.length; ++i)
            map.push([]);

        for (var i = 0; i < gamestate.routes.length; ++i) {
            var route = gamestate.routes[i];
            var from_idx = cities.indexOf(route.from);
            var to_idx = cities.indexOf(route.to);
            /* graph is unidirectional, add edge in both directions */
            map[from_idx].push({
                "dest": to_idx,
                "len": route.length
            });
            map[to_idx].push({
                "dest": from_idx,
                "len": route.length
            });
        }

        return map;
    }

    function dijkstra_distance(from, to) {
        var num_cities = cities.length;
        var infinity = 1/0;

        var from_idx = cities.indexOf(from);
        var to_idx = cities.indexOf(to);
        if (from_idx === -1 || to_idx === -1)
            throw "No such city";

        var visited = [];
        var distance = [];
        for (var i = 0; i < num_cities; ++i) {
            visited.push(false);
            distance.push(infinity);
        }

        var current = from_idx;
        distance[from_idx] = 0;

        while (!visited[to_idx] && current !== -1) {
            var edges = map[current];
            for (var i = 0; i < edges.length; ++i) {
                var edge = edges[i];
                if (visited[edge.dest])
                    continue;
                var new_dist = distance[current] + edge.len;
                if (new_dist < distance[edge.dest])
                    distance[edge.dest] = new_dist;
            }
            visited[current] = true;

            var next = -1;
            for (var i = 0; i < num_cities; ++i)
                if (!visited[i])
                    if (next === -1 || distance[i] < distance[next])
                        next = i;

            current = next;
        }

        return distance[to_idx];
    }

    function city_pair_distance(pair) {
        var split = string_to_city_pair(pair);
        return dijkstra_distance(split[0], split[1]);
    }

    function neighbor_pair_distance(pair) {
        var center = pair.indexOf("–");
        var from = pair.substr(0, center).trim();
        var to = pair.substr(center + 1).trim();
        if (from > to) {
            var temp = from;
            from = to;
            to = temp;
        }
        for (var i = 0; i < gamestate.routes.length; ++i) {
            if (gamestate.routes[i].from === from && gamestate.routes[i].to === to)
                return gamestate.routes[i].length;
        }
        throw "No such route";
    }

    /* Random ************************************************************/

    function random_different_from_generator(generator, count, avoid, maxretries) {
        maxretries = maxretries || count * 100;
        avoid = avoid || [];
        var elements = [];
        var retry = 0;
        while (elements.length < count) {
            var new_element = generator();
            if (elements.indexOf(new_element) === -1 && avoid.indexOf(new_element) === -1) {
                elements.push(new_element);
            } else {
                retry += 1;
                if (retry > maxretries) {
                    throw "Max retries reached";
                }
            }
        }
        return elements;
    }

    function random_city() {
        var random_idx = Math.floor(Math.random() * cities.length);
        return cities[random_idx];
    }

    function random_city_pair() {
        var cities = random_different_from_generator(random_city, 2);
        return city_pair_to_string(cities[0], cities[1]);
    }

    function shuffle_array(array) {
        var currentIndex = array.length;

        // While there remain elements to shuffle...
        while (currentIndex !== 0) {

            // Pick a remaining element...
            var randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            var temp = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temp;
        }
    }

    /** @return string[] */
    function neutral_player_strategy_random() {
        var shuffled = [];
        for (var i = 0; i < double_neighbors.length; ++i)
            shuffled.push(double_neighbors[i]);
        shuffle_array(shuffled);
        return shuffled;
    }
});
