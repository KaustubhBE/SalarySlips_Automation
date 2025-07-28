import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Inventory.css';

const Inventory = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: '',
    size: '',
    price: '',
    brand: '',
    description: ''
  });
  const [showForm, setShowForm] = useState(false);

  const addItem = () => {
    if (newItem.name && newItem.quantity) {
      setInventory([...inventory, { ...newItem, id: Date.now() }]);
      setNewItem({
        name: '',
        quantity: '',
        size: '',
        price: '',
        brand: '',
        description: ''
      });
      setShowForm(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const deleteItem = (id) => {
    setInventory(inventory.filter(item => item.id !== id));
  };

  return (
    <div className="inventory-page">
      <h1>Inventory Management Portal</h1>
      
      {/* Inventory Management Section */}
      <div className="inventory-section">
        <div className="inventory-controls">
          <button 
            onClick={() => setShowForm(!showForm)}
            className="nav-link"
          >
            {showForm ? 'Cancel' : 'Add New Item'}
          </button>
        </div>

        {showForm && (
          <div className="inventory-form">
            <h3>Add New Inventory Item</h3>
            <div className="form-grid">
              <input
                type="text"
                name="name"
                placeholder="Item Name *"
                value={newItem.name}
                onChange={handleChange}
                required
              />
              <input
                type="number"
                name="quantity"
                placeholder="Quantity *"
                value={newItem.quantity}
                onChange={handleChange}
                required
              />
              <input
                type="text"
                name="size"
                placeholder="Size"
                value={newItem.size}
                onChange={handleChange}
              />
              <input
                type="number"
                name="price"
                placeholder="Price"
                value={newItem.price}
                onChange={handleChange}
                step="0.01"
              />
              <input
                type="text"
                name="brand"
                placeholder="Brand"
                value={newItem.brand}
                onChange={handleChange}
              />
              <textarea
                name="description"
                placeholder="Description"
                value={newItem.description}
                onChange={handleChange}
                rows="3"
              />
            </div>
            <button onClick={addItem} className="add-item-btn">
              Add Item to Inventory
            </button>
          </div>
        )}

        {/* Inventory List */}
        <div className="inventory-list">
          <h3>Current Inventory ({inventory.length} items)</h3>
          {inventory.length === 0 ? (
            <p>No items in inventory. Add some items to get started!</p>
          ) : (
            <div className="inventory-table">
              <div className="table-header">
                <span>Item Name</span>
                <span>Quantity</span>
                <span>Size</span>
                <span>Price</span>
                <span>Brand</span>
                <span>Description</span>
                <span>Actions</span>
              </div>
              {inventory.map((item) => (
                <div key={item.id} className="table-row">
                  <span><strong>{item.name}</strong></span>
                  <span>{item.quantity}</span>
                  <span>{item.size || '-'}</span>
                  <span>{item.price ? `$${item.price}` : '-'}</span>
                  <span>{item.brand || '-'}</span>
                  <span>{item.description || '-'}</span>
                  <span>
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="inventory-navigation-links">
        <span 
          onClick={() => navigate('/store')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Back to Store
        </span>
        <span 
          onClick={() => navigate('/reports')} 
          className="nav-link"
          role="button"
          tabIndex={0}
        >
          Reports
        </span>
      </div>
    </div>
  );
}

export default Inventory;