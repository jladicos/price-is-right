import React from "react";
import { Badge, Select } from "@chakra-ui/react";
import { renderToString } from "react-dom/server";

// Test Badge
try {
  const badgeResult = renderToString(React.createElement(Badge, {}, "Test"));
  console.log("Badge works as component:", badgeResult.includes("Test"));
} catch (e) {
  console.log("Badge ERROR:", e.message);
}

// Test Badge.Root if it exists
try {
  if ("Root" in Badge) {
    const badgeRootResult = renderToString(React.createElement(Badge.Root, {}, "Test"));
    console.log("Badge.Root works:", badgeRootResult.includes("Test"));
  } else {
    console.log("Badge.Root does not exist");
  }
} catch (e) {
  console.log("Badge.Root ERROR:", e.message);
}

// Test Select.Root
try {
  const selectResult = renderToString(React.createElement(Select.Root, {}));
  console.log("Select.Root works:", true);
} catch (e) {
  console.log("Select.Root ERROR:", e.message);
}
