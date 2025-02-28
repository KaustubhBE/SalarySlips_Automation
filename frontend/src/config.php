<?php
$dbname = 'users.db';

// Create (connect to) SQLite database in file
$conn = new SQLite3($dbname);

// Check connection
if (!$conn) {
    die("Connection failed: " . $conn->lastErrorMsg());
}

// Function to authenticate user
function authenticateUser($email, $password) {
    global $conn;
    $stmt = $conn->prepare('SELECT * FROM users WHERE email = :email');
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        return $user;
    } else {
        return false;
    }
}

// Function to check if user is admin
function isAdmin($userId) {
    global $conn;
    $stmt = $conn->prepare('SELECT role FROM users WHERE id = :id');
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);

    return $user && $user['role'] === 'admin';
}

// Function to assign role to user
function assignRole($userId, $role) {
    global $conn;
    $stmt = $conn->prepare('UPDATE users SET role = :role WHERE id = :id');
    $stmt->bindValue(':role', $role, SQLITE3_TEXT);
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    return $stmt->execute();
}

// Function to get user info
function getUserInfo($userId) {
    global $conn;
    $stmt = $conn->prepare('SELECT * FROM users WHERE id = :id');
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    return $result->fetchArray(SQLITE3_ASSOC);
}
?>