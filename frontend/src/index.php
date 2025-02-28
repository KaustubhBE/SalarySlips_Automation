<?php
include 'config.php';

// Handle form submissions
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_POST['add_user'])) {
        $username = $_POST['username'];
        $email = $_POST['email'];
        $role = $_POST['role'];
        $password = password_hash($_POST['password'], PASSWORD_DEFAULT); // Hash the password

        // Prepare an SQL statement
        $stmt = $conn->prepare("INSERT INTO users (username, email, password, role) VALUES (:username, :email, :password, :role)");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->lastErrorMsg());
        }

        // Bind parameters to the SQL statement
        $stmt->bindValue(':username', $username, SQLITE3_TEXT);
        $stmt->bindValue(':email', $email, SQLITE3_TEXT);
        $stmt->bindValue(':password', $password, SQLITE3_TEXT);
        $stmt->bindValue(':role', $role, SQLITE3_TEXT);

        // Execute the statement
        if ($stmt->execute()) {
            echo "New user added successfully";
        } else {
            echo "Error: " . $conn->lastErrorMsg();
        }

        // Close the statement
        $stmt->close();
    } elseif (isset($_POST['delete_user'])) {
        $user_id = $_POST['user_id'];

        // Prepare an SQL statement
        $stmt = $conn->prepare("DELETE FROM users WHERE id = :id");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->lastErrorMsg());
        }

        // Bind parameters to the SQL statement
        $stmt->bindValue(':id', $user_id, SQLITE3_INTEGER);

        // Execute the statement
        if ($stmt->execute()) {
            echo "User deleted successfully";
        } else {
            echo "Error: " . $conn->lastErrorMsg();
        }

        // Close the statement
        $stmt->close();
    } elseif (isset($_POST['update_role'])) {
        $user_id = $_POST['user_id'];
        $role = $_POST['role'];

        // Prepare an SQL statement
        $stmt = $conn->prepare("UPDATE users SET role = :role WHERE id = :id");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->lastErrorMsg());
        }

        // Bind parameters to the SQL statement
        $stmt->bindValue(':role', $role, SQLITE3_TEXT);
        $stmt->bindValue(':id', $user_id, SQLITE3_INTEGER);

        // Execute the statement
        if ($stmt->execute()) {
            echo "User role updated successfully";
        } else {
            echo "Error: " . $conn->lastErrorMsg();
        }

        // Close the statement
        $stmt->close();
    }
}

// Fetch users from the database
$sql = "SELECT * FROM users";
$result = $conn->query($sql);
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Panel</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>Admin Panel</h1>
    <h2>Add User</h2>
    <form action="Dashboard.php" method="post">
        <input type="hidden" name="add_user" value="1">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required>
        <label for="role">Role:</label>
        <select id="role" name="role" required>
            <option value="user">User</option>
            <option value="admin">Admin</option>
        </select>
        <button type="submit">Add User</button>
    </form>

    <h2>Users</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
        </tr>
        <?php
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            echo "<tr>
                    <td>{$row['id']}</td>
                    <td>{$row['username']}</td>
                    <td>{$row['email']}</td>
                    <td>{$row['role']}</td>
                    <td>
                        <form action='Dashboard.php' method='post' style='display:inline;'>
                            <input type='hidden' name='delete_user' value='1'>
                            <input type='hidden' name='user_id' value='{$row['id']}'>
                            <button type='submit'>Delete</button>
                        </form>
                        <form action='Dashboard.php' method='post' style='display:inline;'>
                            <input type='hidden' name='update_role' value='1'>
                            <input type='hidden' name='user_id' value='{$row['id']}'>
                            <select name='role'>
                                <option value='user' " . ($row['role'] == 'user' ? 'selected' : '') . ">User</option>
                                <option value='admin' " . ($row['role'] == 'admin' ? 'selected' : '') . ">Admin</option>
                            </select>
                            <button type='submit'>Update Role</button>
                        </form>
                    </td>
                  </tr>";
        }
        ?>
    </table>
</body>
</html>

<?php
$conn->close();
?>