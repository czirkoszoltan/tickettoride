function ticket_to_ride() {
    
    var STATE_SELECT_MAP = 0;
    var STATE_FIRST_STEP = 1;
    var STATE_SELECT_TICKETS = 2;
    var STATE_PLAY_GAME = 3;
    var STATE_SELECT_NEIGHBOR_TICKETS = 4;

    var steamwhistle = document.querySelector('#steamwhistle');

    var maps = [
        {
            name: 'EU',
            filename: 'map-eu.json?v2',
            emoji: '🚂'
        },
        {
            name: 'NL',
            filename: 'map-nl.json?v1',
            emoji: '🌷'
        },
        {
            name: 'USA',
            filename: 'map-usa.json?v1',
            emoji: '🗽'
        }
    ];

    var gamestate = {
        state: STATE_SELECT_MAP,
        
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

        /* [
         *      {
         *          route: "Edinburgh - London",
         *          built: 0 | 1
         *      }
         * ]
         */
        to_build: [],
    };
    window.gamestate = gamestate;
    
    /* Array of city names, sorted alphabetically */
    var cities = [];

    /* Array of routes like "Edinburgh – London", sorted alphabetically */
    var neighbors = [];

    /* Array of neighbors like "Edinburgh – London" sorted alphabetically - only if multiple edges exist between the two cities */
    var double_neighbors = [];

    /* Graph of the map. Array of cities, index is city idx (see cities array).
     * Array elements are edges. Edges are objects like
     * {dest: 4 (index to cities array), len: 3 (length of edge)}.
     * Contains both directions, like Edinburgh -> London and London -> Edinburgh. */
    var map = [];

    init();

    function init() {
        window.onerror = function(message, source, lineno, colno, error) {
            alert(message + " at " + source + ":" + lineno);
        };
        draw();
    }
    
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

        gamestate = decoded_state;
        create_data_structures();
        draw();
    }

    function create_data_structures() {
        cities = create_cities();
        neighbors = create_neighbors();
        double_neighbors = create_double_neighbors();
        map = create_map();
    }

    function get_to_build_route_names() {
        var routes = [];
        forEach(gamestate.to_build, function(route) {
            routes.push(route.route);
        });
        return routes;
    }

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

    function draw() {
        switch (gamestate.state) {
            case STATE_SELECT_MAP:
                var html = Mustache.render(getTemplate('#screen-select-map'), {maps: maps});
                setHtml('#screen', html);
                break;

            case STATE_FIRST_STEP:
                setHtml('#screen', getTemplate('#screen-first-step'));
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
            addEventListener(element, 'click', event_load_map.bind(null, maps[index].filename));
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

    function event_load_map(url) {
        function reqListener() {
            try {
                var routes = JSON.parse(this.responseText);
            } catch (e) {
                alert("Cannot load " + url);
                return;
            }
            if (!(routes instanceof Array)) {
                alert("Invalid file from " + url);
                return;
            }

            gamestate.routes = routes;
            create_data_structures();

            gamestate.state = STATE_FIRST_STEP;
            draw();
        }

        var oReq = new XMLHttpRequest();
        oReq.addEventListener('load', reqListener);
        oReq.open('GET', url);
        oReq.send();
    }

    function event_new_tickets() {
        var avoid = get_to_build_route_names().concat(neighbors);
        var new_tickets = random_different(random_city_pair, 3, avoid);
        gamestate.new_tickets = [];
        forEach(new_tickets, function(route) {
            gamestate.new_tickets.push({
                route: route,
                route_with_distance: city_pair_with_distance(route),
                keep: null
            })
        });

        gamestate.state = STATE_SELECT_TICKETS;
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
        gamestate.to_build[index].built = gamestate.to_build[index].built ? 0 : 1;
        if (gamestate.to_build[index].built)
            steamwhistle.play();

        draw();
    }

    function event_new_neighbor_ticket() {
        if (gamestate.to_build.length === double_neighbors.length) {
            alert("No more routes!");
            return;
        }
        if (gamestate.to_build.length > 0 && Math.random() < 0.2) {
            alert("No ticket for this turn 😞");
            return;
        }

        var avoid = get_to_build_route_names();
        var route = random_different(random_double_neighbor, 1, avoid)[0];
        gamestate.to_build.push({
            route: route,
            built: 0
        });

        gamestate.state = STATE_SELECT_NEIGHBOR_TICKETS;
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

    function split_city_pair(pair) {
        var center = pair.indexOf("–");
        var from = pair.substr(0, center).trim();
        var to = pair.substr(center + 1).trim();
        return [from, to];
    }

    function city_pair_with_distance(pair) {
        var split = split_city_pair(pair);
        var from = split[0];
        var to = split[1];
        var dist = dijkstra_distance(split[0], split[1]);
        return from + " – " + to + " " + dist;
    }

    /* Data structures *******************************************/

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

    /* Random ************************************************************/

    function random_different(generator, count, avoid) {
        avoid = avoid || [];
        var elements = [];
        while (elements.length < count) {
            var new_element = generator();
            if (elements.indexOf(new_element) === -1 && avoid.indexOf(new_element) === -1)
                elements.push(new_element);
        }
        return elements;
    }

    function random_city() {
        var random_idx = Math.floor(Math.random() * cities.length);
        return cities[random_idx];
    }

    function random_city_pair() {
        var cities = random_different(random_city, 2);
        return city_pair_to_string(cities[0], cities[1]);
    }

    function random_double_neighbor() {
        var random_idx = Math.floor(Math.random() * double_neighbors.length);
        return double_neighbors[random_idx];
    }
}


document.addEventListener("DOMContentLoaded", ticket_to_ride);
