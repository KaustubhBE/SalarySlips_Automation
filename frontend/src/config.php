<?php
$dbname = 'users.db';

// Create (connect to) SQLite database in file
$conn = new SQLite3($dbname);

// Check connection
if (!$conn) {
    die("Connection failed: " . $conn->lastErrorMsg());
}
?>