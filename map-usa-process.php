<?php

$file = file_get_contents('map-usa-input.json');
$json = json_decode($file);
$output = [];
foreach ($json as $route) {
    $elem = (object) [
        'from' => $route[0],
        'to' => $route[1],
        'length' => $route[2],
        'color' => $route[3],
        'joker' => $route[4] ?? 0,
        'tunnel' => $route[5] ?? false,
    ]; 
    if ($elem->from == $elem->to)
        throw new \Exception("Hibás route, egyforma városok: {$elem->from}");
    if ($elem->from > $elem->to)
        list($elem->from, $elem->to) = array($elem->to, $elem->from);
    $output[] = $elem;
}
$json = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

file_put_contents('map-usa.json', $json);

