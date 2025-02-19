<?php
include 'config.php';

// Handle form submissions
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_POST['add_user'])) {
        $username = $_POST['username'];
        $email = $_POST['email'];
        $role = $_POST['role'];

        // Prepare an SQL statement
        $stmt = $conn->prepare("INSERT INTO users (username, email, role) VALUES (?, ?, ?)");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->error);
        }

        // Bind parameters to the SQL statement
        $stmt->bind_param("sss", $username, $email, $role);

        // Execute the statement
        if ($stmt->execute() === TRUE) {
            echo "New user added successfully";
        } else {
            echo "Error: " . $stmt->error;
        }

        // Close the statement
        $stmt->close();
    } elseif (isset($_POST['delete_user'])) {
        $user_id = $_POST['user_id'];

        // Prepare an SQL statement
        $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->error);
        }

        // Bind parameters to the SQL statement
        $stmt->bind_param("i", $user_id);

        // Execute the statement
        if ($stmt->execute() === TRUE) {
            echo "User deleted successfully";
        } else {
            echo "Error: " . $stmt->error;
        }

        // Close the statement
        $stmt->close();
    } elseif (isset($_POST['update_role'])) {
        $user_id = $_POST['user_id'];
        $role = $_POST['role'];

        // Prepare an SQL statement
        $stmt = $conn->prepare("UPDATE users SET role = ? WHERE id = ?");
        if ($stmt === false) {
            die("Error preparing statement: " . $conn->error);
        }

        // Bind parameters to the SQL statement
        $stmt->bind_param("si", $role, $user_id);

        // Execute the statement
        if ($stmt->execute() === TRUE) {
            echo "User role updated successfully";
        } else {
            echo "Error: " . $stmt->error;
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
    <form action="index.php" method="post">
        <input type="hidden" name="add_user" value="1">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>
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
        if ($result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                echo "<tr>
                        <td>{$row['id']}</td>
                        <td>{$row['username']}</td>
                        <td>{$row['email']}</td>
                        <td>{$row['role']}</td>
                        <td>
                            <form action='index.php' method='post' style='display:inline;'>
                                <input type='hidden' name='delete_user' value='1'>
                                <input type='hidden' name='user_id' value='{$row['id']}'>
                                <button type='submit'>Delete</button>
                            </form>
                            <form action='index.php' method='post' style='display:inline;'>
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
        } else {
            echo "<tr><td colspan='5'>No users found</td></tr>";
        }
        ?>
    </table>
</body>
</html>

<?php
$conn->close();
?>