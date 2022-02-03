<?php

$file = file_get_contents('map-ams-input.json');
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
//    if (!in_array($elem->from, $cities))
//        throw new \Exception("Nincs {$elem->from} város");
//    if (!in_array($elem->to, $cities))
//        throw new \Exception("Nincs {$elem->to} város");
    if ($elem->from == $elem->to)
        throw new \Exception("Hibás route, egyforma városok: {$elem->from}");
    if ($elem->from > $elem->to)
        list($elem->from, $elem->to) = array($elem->to, $elem->from);
    $output[] = $elem;
}
$json = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

//print_r(array_unique(array_merge(array_column($output, 'from'), array_column($output, 'to'))));

file_put_contents('map-ams.json', $json);

