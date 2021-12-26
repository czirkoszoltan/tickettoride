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
    /* Tömb  városok neveivel ("London"), ábécében */
    var cities = create_cities();
    
    /* Tömb a várospárok neveivel ("Edinburg – London") ábécében */
    var neighbors = create_neighbors();
    
    /* Tömb a várospárok neveivel ("Edinburg – London") ábécében, de csak azok, amik közt legalább 2 út van */
    var double_neighbors = create_double_neighbors();
    
    /* Gráf a térképpel. Tömb, aminek az indexei a városok (lásd a cities tömböt),
     * az elemei pedig az élek. Az élek kis objektumok, pl.
     * {dest: 4 (index a cities tömbbe), len: 3 (vonatok száma)}.
     * Mindkét irány benne van. */
    var map = create_map();
    
    const STATE_CLEAR = 0;
    const STATE_GENERATED = 1;

    var state = STATE_CLEAR;
    var to_build = [];

    var selected_tickets = document.getElementById('selected-tickets');
    var random_ticket_1 = document.getElementById('random-ticket-1');
    var random_ticket_2 = document.getElementById('random-ticket-2');
    var random_ticket_3 = document.getElementById('random-ticket-3');
    var tickets_button = document.getElementById('tickets-button');
    var neighbors_button = document.getElementById('neighbors-button');
    var random_section = document.getElementById('random-section');
    var steamwhistle = document.getElementById('steamwhistle');

    /* Utility ***********************************************************/
    
    function city_pair_to_string(from, to) {
        // mindig ábécében, hogy később ne lehessen "amsterdam-wien" és "wien-amsterdam" ticket
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

    function htmlspecialchars(text) {
        var map = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        };
        
        if (!text)
            return "";
        return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
    function city_pair_with_distance(pair) {
        var split = split_city_pair(pair);
        var from = split[0];
        var to = split[1];
        var dist = dijkstra_distance(split[0], split[1]);
        return from + " – " + to + " " + dist;
    }
    
    /* Adatszerkezetek építése *******************************************/
    
    function create_cities() {
        var cities = [];

        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
            if (cities.indexOf(route.from) == -1)
                cities.push(route.from);
            if (cities.indexOf(route.to) == -1)
                cities.push(route.to);
        }
        cities.sort();
        
        return cities;
    }
    
    function create_neighbors() {
        var neighbors = [];
        
        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
            var pair_str = city_pair_to_string(route.from, route.to);
            if (neighbors.indexOf(pair_str) == -1)
                neighbors.push(pair_str);
        }
        
        return neighbors;
    }
    
    function create_double_neighbors() {
        var double_neighbors = [];
        
        var neighbors = {};
        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
            var pair_str = city_pair_to_string(route.from, route.to);
            neighbors[pair_str] = (neighbors[pair_str] || 0) + 1;
            if (neighbors[pair_str] == 2)
                double_neighbors.push(pair_str);
        }

        return double_neighbors;
    }
    
    function create_map() {
        var map = [];        
        for (var i = 0; i < cities.length; ++i)
            map.push([]);
        
        for (var i = 0; i < routes.length; ++i) {
            var route = routes[i];
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
            throw "Nincs ilyen város";
        
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
        var cities = random_different(random_city, 2);
        return city_pair_to_string(cities[0], cities[1]);
    }
    
    function random_double_neighbor() {
        var random_idx = Math.floor(Math.random() * double_neighbors.length);
        return double_neighbors[random_idx];
    }

    /* Ui & game logic ***************************************************/
    
    function set_random_tickets() {
        neighbors_button.style.display = 'none';
        random_section.style.display = '';
        var avoid = to_build.concat(neighbors);
        var tickets = random_different(random_city_pair, 3, avoid);
        random_ticket_1.setAttribute('data-ticket', tickets[0]);
        random_ticket_1.setAttribute('data-ticket-visible', city_pair_with_distance(tickets[0]));
        random_ticket_2.setAttribute('data-ticket', tickets[1]);
        random_ticket_2.setAttribute('data-ticket-visible', city_pair_with_distance(tickets[1]));
        random_ticket_3.setAttribute('data-ticket', tickets[2]);
        random_ticket_3.setAttribute('data-ticket-visible', city_pair_with_distance(tickets[2]));
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
    
    function add_random_neighbor() {
        tickets_button.style.display = 'none';
        try {
            if (to_build.length == double_neighbors.length) {
                throw "No more routes!";
            }
            if (Math.random() < 0.2) {
                throw "No ticket for this turn 😞"
            }
            var ticket = random_different(random_double_neighbor, 1, to_build)[0];
            to_build.push(ticket);
            add_build_div(ticket);
        } catch (e) {
            alert(e.toString());
        }
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
                tickets_button.setAttribute('data-title', "Keep Selected Tickets");
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
    neighbors_button.addEventListener('click', add_random_neighbor);
}

function init() {
    var select_map = document.getElementById('select-map');
    var play_game = document.getElementById('play-game');
    var map_usa = document.getElementById('map-usa');
    var map_eu = document.getElementById('map-eu');
    var map_nl = document.getElementById('map-nl');
    var random_section = document.getElementById('random-section');

    play_game.style.display = 'none';
    random_section.style.display = 'none';
    
    map_usa.addEventListener('click', load_map.bind(null, 'map-usa.json?v1'));
    map_eu.addEventListener('click', load_map.bind(null, 'map-eu.json?v2'));
    map_nl.addEventListener('click', load_map.bind(null, 'map-nl.json?v1'));
    
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
