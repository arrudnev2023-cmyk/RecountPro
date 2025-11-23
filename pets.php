<?php
header("Content-Type: application/json; charset=utf-8");
$file = "pets.json";

if (!file_exists($file)) {
  file_put_contents($file, "[]");
}

$pets = json_decode(file_get_contents($file), true);

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $data = json_decode(file_get_contents("php://input"), true);
  $data["id"] = "p" . time();
  $pets[] = $data;
  file_put_contents($file, json_encode($pets, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
  echo json_encode(["status"=>"ok"]);
} else {
  echo json_encode($pets, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
}
?>
