import React from "react";

const ToggleButton = ({ isToggled, onToggle }) => {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          textWrap: "wrap",
          width: "80px",
          fontSize: "16px",
          backgroundColor: isToggled ? "green" : "red",
          color: "white",
          border: "none",
          borderRadius: "5px",
          padding: "5px 10px",
        }}
      >
        {isToggled ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
};

export default ToggleButton;