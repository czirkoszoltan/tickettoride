/**
 * @param routes
 *      [
 *          {
 *           "from": "Edinburgh",
 *           "to": "London",
 *           "length": 4,
 *           "color": "fekete",
 *           "joker": 0,
 *           "tunnel": false
 *          },
 *          ...
 *      ]
 *
 */
function ticket_to_ride(routes) {
    var cities = create_cities();
    cities.sort();
    console.log(cities);
    var neighbors = create_neighbors();

    const STATE_CLEAR = 0;
    const STATE_GENERATED = 1;

    var state = STATE_CLEAR;
    var to_build = [];

    var selected_tickets = document.getElementById('selected-tickets');
    var random_ticket_1 = document.getElementById('random-ticket-1');
    var random_ticket_2 = document.getElementById('random-ticket-2');
    var random_ticket_3 = document.getElementById('random-ticket-3');
    var tickets_button = document.getElementById('tickets-button');
    var steamwhistle = document.getElementById('steamwhistle');
    
    function create_cities() {
        var cities = [];
        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
            if (route.from >= route.to) {
                var temp = route.from;
                route.from = route.to;
                route.to = temp;
            }
            if (cities.indexOf(route.from) == -1)
                cities.push(route.from);
            if (cities.indexOf(route.to) == -1)
                cities.push(route.to);
        }
        return cities;
    }
    
    function city_pair_to_string(from, to) {
        return from + " – " + to;
    }
    
    function create_neighbors() {
        var neighbors = [];
        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
            neighbors.push(city_pair_to_string(route.from, route.to));
        }
        return neighbors;
    }

    function random_different(generator, count, avoid) {
        avoid = avoid || [];
        var elements = [];
        while (elements.length < count) {
            var new_element = generator();
            if (elements.indexOf(new_element) == -1 && avoid.indexOf(new_element) == -1)
                elements.push(new_element);
        }
        return elements;
    }

    function random_city() {
        var random_idx = Math.floor(Math.random() * cities.length);
        return cities[random_idx];
    }
            
    function random_city_pair() {
        var pair = random_different(random_city, 2);
        pair.sort();    // mindig ábécében, hogy később ne lehessen "amsterdam-wien" és "wien-amsterdam" ticket
        return city_pair_to_string(pair[0], pair[1]);
    }

    function set_random_tickets() {
        var tickets = random_different(random_city_pair, 3, to_build);
        random_ticket_1.setAttribute('data-ticket', tickets[0]);
        random_ticket_2.setAttribute('data-ticket', tickets[1]);
        random_ticket_3.setAttribute('data-ticket', tickets[2]);
        random_ticket_1.setAttribute('data-keep', '');
        random_ticket_2.setAttribute('data-keep', '');
        random_ticket_3.setAttribute('data-keep', '');
    }

    function clear_tickets() {
        random_ticket_1.setAttribute('data-ticket', '');
        random_ticket_2.setAttribute('data-ticket', '');
        random_ticket_3.setAttribute('data-ticket', '');
    }

    function get_tickets() {
        var tickets = [
            random_ticket_1.getAttribute('data-ticket'),
            random_ticket_2.getAttribute('data-ticket'),
            random_ticket_3.getAttribute('data-ticket'),
        ];
        return tickets;
    }
            
    function keep_button_value(button) {
        var keepstr = button.getAttribute('data-keep');
        if (keepstr === '1')
            return true;
        else if (keepstr === '0')
            return false;
        else
            return null;
    }

    function keep_button_click() {
        var value = keep_button_value(this);
        var newvalue = value ? 0 : 1;
        this.setAttribute('data-keep', newvalue);
    }

    function add_build_div(ticket) {
        var div = document.createElement('div');
        var a = document.createElement('a');
        a.setAttribute('tabindex', '0');
        a.setAttribute('class', 'ticket-build has-after-icon');
        a.setAttribute('data-built', '0');
        a.setAttribute('data-title', ticket);
        a.addEventListener('click', ticket_build_click);
        
        div.appendChild(a);
        selected_tickets.appendChild(div);
    }

    function ticket_build_click() {
        var built = !+this.getAttribute('data-built');  // new state
        if (built)
            steamwhistle.play();
        this.setAttribute('data-built', built ? '1' : '0');
    }

    function tickets_button_click() {
        switch (state) {
            case STATE_CLEAR:
                set_random_tickets();
                tickets_button.setAttribute('data-title', "Select Tickets");
                state = STATE_GENERATED;
                return;
                
            case STATE_GENERATED:
                var keep = [ keep_button_value(random_ticket_1), keep_button_value(random_ticket_2), keep_button_value(random_ticket_3) ];
                var tickets = get_tickets();

                if (keep.indexOf(true) == -1) {
                    alert("You have to keep at least one ticket.");
                    return;
                }
                
                for (var i = 0; i < tickets.length; ++i) {
                    if (keep[i]) {
                        to_build.push(tickets[i]);
                        add_build_div(tickets[i]);
                    }
                }
                
                clear_tickets();
                tickets_button.setAttribute('data-title', "New Tickets");
                state = STATE_CLEAR;
                return;
        }
    }


    random_ticket_1.addEventListener('click', keep_button_click);
    random_ticket_2.addEventListener('click', keep_button_click);
    random_ticket_3.addEventListener('click', keep_button_click);

    tickets_button.addEventListener('click', tickets_button_click);
}

function init() {
    var select_map = document.getElementById('select-map');
    var play_game = document.getElementById('play-game');
    var map_usa = document.getElementById('map-usa');
    var map_eu = document.getElementById('map-eu');
    play_game.style.display = 'none';
    
    map_usa.addEventListener('click', load_map.bind(null, 'map-usa.json'));
    map_eu.addEventListener('click', load_map.bind(null, 'map-eu.json'));
    
    function load_map(filename) {
        function reqListener() {
            try {
                var routes = JSON.parse(this.responseText);
                if (!(routes instanceof Array))
                    throw "invalid format";
            } catch (e) {
                alert("Cannot load " + filename);
                return;
            }
            
            ticket_to_ride(routes);
            select_map.style.display = 'none';
            play_game.style.display = null;
        }

        var oReq = new XMLHttpRequest();
        oReq.addEventListener("load", reqListener);
        oReq.open("GET", filename);
        oReq.send();
    }
}

document.addEventListener("DOMContentLoaded", init);
