"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 430, height: 560 });
// Handle messages received from the HTML page
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    // if (msg.type === 'select-frame') {
    //   await handleSelectFrameMessage();
    // } else
    if (msg.type === "create-palette") {
        yield handleCreatePaletteMessage();
    }
    else if (msg.type === "assign-color") {
        yield handleAssignColorMessage(msg);
    }
    else if (msg.type === "generate-palette-ai") {
        yield handleCreatePaletteAiVersion(msg.value);
    }
    else if (msg.type === "recolor-frame-ai") {
        yield handleAssignColorAIVersion(msg.value);
    }
});
// Function to handle the 'select-frame' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function handleSelectFrameMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        const selectedFrames = figma.currentPage.selection.filter((node) => node.type === "FRAME");
        if (selectedFrames.length === 0) {
            figma.notify("Please select a frame on the canvas.");
            return;
        }
        // Assuming you want to work with the first selected frame
        const selectedFrame = selectedFrames[selectedFrames.length - 1];
        figma.notify(`Frame "${selectedFrame.name}" selected.`);
        console.log("Frame Selected: " + selectedFrame.name);
        // Store the selected frame globally if needed
        figma.root.setPluginData("selectedFrameId", selectedFrame.id);
    });
}
// Function to handle the 'create-palette' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function handleCreatePaletteMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        handleSelectFrameMessage();
        const frameId = figma.root.getPluginData("selectedFrameId");
        if (!frameId) {
            figma.notify("No frame selected. Please select a frame first.");
            return;
        }
        try {
            const node = yield figma.getNodeByIdAsync(frameId);
            if (!node || node.type !== "FRAME") {
                figma.notify("Selected frame is no longer available or is not a frame.");
                return;
            }
            const frame = node;
            // Export the frame as JPEG
            const jpegBytes = yield exportFrameAsJPEG(frame);
            console.log("JPEG Bytes:", jpegBytes); // Log the output to verify
            // Modify the type of colorPalettes to expect an array of arrays
            try {
                const colorPalettes = yield sendToAPI(jpegBytes);
                console.log("TEST palettes:", colorPalettes); // Ensure this logs the correct structure
                createColorPaletteOnCanvas(colorPalettes);
            }
            catch (error) {
                console.error("Error in sending to API:", error); // Log the error if it occurs
            }
        }
        catch (error) {
            console.error("Error details:", error); // Log the error details
            figma.notify("An error occurred while exporting the image or sending it to the API.");
        }
    });
}
function fetchAIColorPalette(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Construct the prompt
            prompt +=
                " And make sure the colors are not too similar to each other and used together to create a beautiful design." +
                    " Also, the color palette must consist of 5 colors " +
                    " and make sure to return the color codes of the color palette in hex format " +
                    " and return only the color codes in the response, do not return text or anything else.";
            // Make the API request
            const response = yield fetch("http://127.0.0.1:5000/process_prompt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ input_string: prompt }), // Send the prompt as JSON
            });
            // Check if the response is OK (status in the range 200-299)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Parse the JSON response
            const data = yield response.json();
            // Split the color codes string into a list and return it
            const colorCodesList = data.palette.trim().split(/\s+/); // Splitting by whitespace
            return colorCodesList;
        }
        catch (error) {
            console.error(error);
            figma.notify("An error occurred while sending the request to the API.");
            return []; // Return an empty array in case of error
        }
    });
}
function handleCreatePaletteAiVersion(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const colorCodesList = yield fetchAIColorPalette(prompt);
            console.log(colorCodesList);
            // Log the list of color codes
            createColorPaletteOnCanvasAI(colorCodesList);
            // console.log("Color Codes List:", colorCodesList);
        }
        catch (error) {
            console.error(error);
            figma.notify("An error occurred while sending the request to the API.");
        }
    });
}
function selectFrameLayers() {
    return __awaiter(this, void 0, void 0, function* () {
        handleSelectFrameMessage();
        const frameId = figma.root.getPluginData("selectedFrameId");
        if (!frameId) {
            figma.notify("No frame selected. Please select a frame first.");
            return []; // Return an empty array if no frame is selected
        }
        const node = yield figma.getNodeByIdAsync(frameId);
        if (!node || node.type !== "FRAME") {
            figma.notify("Selected frame is no longer available or is not a frame.");
            return []; // Return an empty array if the selected node is invalid
        }
        const frame = node;
        figma.notify(`Frame "${frame.name}" selected.`);
        const allLayers = frame.findAll().reverse(); // Find all layers within the frame
        // Convert allLayers to include the same properties as in handleAssignColorMessage
        const layers = allLayers.map((layer, idx) => {
            const newName = `${layer.name}_${idx}`; // Create a unique name based on the index
            layer.name = newName; // Update the layer name directly
            const color = getLayerColor(layer); // Extract the color using the getLayerColor function
            return { name: newName, color: color }; // Return objects with the same properties
        });
        return layers; // Return the array of layers
    });
}
function handleAssignColorAIVersion(prompt) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const layers = yield selectFrameLayers();
            const colorCodesList = yield fetchAIColorPalette(prompt);
            assignColorsToLayers(layers, colorCodesList, 1);
        }
        catch (error) {
            console.error(error);
            figma.notify("An error occurred while sending the request to the API.");
        }
    });
}
// Function to export a frame as JPEG
function exportFrameAsJPEG(frame) {
    return __awaiter(this, void 0, void 0, function* () {
        const imageData = yield frame.exportAsync({ format: "JPG" });
        return imageData;
    });
}
// Function to send the JPEG image data to the API and return the color palette
function sendToAPI(imageData) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Sending image to API...");
        const response = yield fetch("http://localhost:5000/process_image", {
            method: "POST",
            headers: {
                "Content-Type": "image/jpeg", // Ensure this matches the format you are sending
            },
            body: imageData,
        });
        //console.log("API response:", response);
        if (!response.ok) {
            const errorText = yield response.text();
            throw new Error(`Failed to send image to API: ${response.statusText}, ${errorText}`);
        }
        const result = yield response.json();
        //console.log("API response:", result); // Log the API response
        // console.log("Color palettes:", result.color_palettes);
        figma.notify("Image exported and palette received successfully.");
        //  console.log("Color palettes from API:", result.color_palettes);
        return result.color_palettes; // Change this to get the array of arrays from the API
    });
}
function createColorPaletteOnCanvasAI(colorPalette) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodes = [];
        const selection = figma.currentPage.selection;
        if (selection.length === 0 || selection[0].type !== "FRAME") {
            figma.notify("Please select a frame first.");
            return;
        }
        const selectedFrame = selection[0]; // Cast to FrameNode
        const startX = selectedFrame.x; // Frame's X position
        const startY = selectedFrame.y; // Frame's Y position
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        colorPalette.forEach((color, index) => {
            const text = figma.createText();
            figma.currentPage.appendChild(text);
            text.x = startX; // Align with the first color
            text.y = startY - 210; // Position above the palette
            text.characters = `AI generated palette`;
            text.fontSize = 26;
            text.fontName = { family: "Inter", style: "Regular" };
            text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
            nodes.push(text);
            const rect = figma.createRectangle();
            rect.x = startX + index * 110; // Position rectangles with some spacing
            rect.y = startY - 170;
            rect.resize(100, 100);
            rect.fills = [
                { type: "SOLID", color: hexToRgb(color), boundVariables: {} },
            ];
            figma.currentPage.appendChild(rect);
            nodes.push(rect);
        });
        figma.currentPage.selection = nodes;
    });
}
function createColorPaletteOnCanvas(colorPalettes) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodes = [];
        const selection = figma.currentPage.selection;
        if (selection.length === 0 || selection[0].type !== "FRAME") {
            figma.notify("Please select a frame first.");
            return;
        }
        const selectedFrame = selection[0]; // Cast to FrameNode
        const startX = selectedFrame.x; // Frame's X position
        const startY = selectedFrame.y + 800; // Frame's Y position
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        colorPalettes.forEach((palette, paletteIndex) => {
            // Create a text label for each palette
            const text = figma.createText();
            figma.currentPage.appendChild(text);
            text.x = startX; // Align with the first color
            text.y = (startY + paletteIndex * 150) - 30; // Position above the palette
            text.characters = `Palette ${paletteIndex + 1}`;
            text.fontSize = 26;
            text.fontName = { family: "Inter", style: "Regular" };
            text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
            nodes.push(text);
            palette.forEach((color, colorIndex) => {
                const rect = figma.createRectangle();
                rect.x = startX + colorIndex * 110; // Position rectangles with some spacing
                rect.y = startY + paletteIndex * 150; // Space rows apart
                rect.resize(100, 100);
                rect.fills = [
                    { type: "SOLID", color: hexToRgb(color), boundVariables: {} },
                ];
                figma.currentPage.appendChild(rect);
                nodes.push(rect);
            });
        });
        figma.currentPage.selection = nodes;
        //figma.viewport.scrollAndZoomIntoView(nodes);
    });
}
// Helper function to convert hex color to RGB
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r: r / 255, g: g / 255, b: b / 255 };
}
//Function to get Color from layer
function getLayerColor(layer) {
    var _a;
    let color = [0, 0, 0]; // Default color (black)
    // Type narrowing for layers that have fills
    if ('fills' in layer && Array.isArray(layer.fills) && layer.fills.length > 0) {
        const fill = layer.fills[0];
        // Make sure the fill is a valid Solid color type
        if (fill.type === 'SOLID') {
            const { r, g, b } = fill.color;
            color = [r * 255, g * 255, b * 255];
        }
        else if (fill.type === 'GRADIENT_LINEAR' ||
            fill.type === 'GRADIENT_RADIAL' ||
            fill.type === 'GRADIENT_ANGULAR' ||
            fill.type === 'GRADIENT_DIAMOND') {
            const gradientStop = (_a = fill.gradientStops[0]) === null || _a === void 0 ? void 0 : _a.color;
            if (gradientStop) {
                const { r, g, b } = gradientStop;
                color = [r * 255, g * 255, b * 255];
            }
        }
        else if (fill.type === 'IMAGE') {
            console.log(`Layer "${layer.name}" has an image fill, skipping color extraction.`);
        }
    }
    return color; // Return color as an array [r, g, b]
}
// Function to handle the 'assign-color' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function handleAssignColorMessage(msg) {
    return __awaiter(this, void 0, void 0, function* () {
        if (msg.type === "assign-color") {
            handleSelectFrameMessage();
            const frameId = figma.root.getPluginData("selectedFrameId");
            if (!frameId) {
                figma.notify("No frame selected. Please select a frame first.");
                return;
            }
            const node = yield figma.getNodeByIdAsync(frameId);
            if (!node || node.type !== "FRAME") {
                figma.notify("Selected frame is no longer available or is not a frame.");
                return;
            }
            const frame = node;
            figma.notify(`Frame "${frame.name}" selected.`);
            // Export the frame as JPEG
            const jpegBytes = yield exportFrameAsJPEG(frame);
            try {
                // Send the JPEG image data to the API and wait for the palettes
                const colorPalettes = yield sendToAPI(jpegBytes);
                console.log(colorPalettes);
                if (!Array.isArray(colorPalettes) || colorPalettes.length === 0) {
                    figma.notify("No palettes received from the API.");
                    return;
                }
                const frameTitles = ["Enhanced", "PL", "Sequential", "Enhanced", "PL"];
                const paletteWidth = 5 * 90; // Width of five color boxes
                const minSpacing = 50; // Minimum spacing if frame width is larger
                // Now, after receiving the palettes, start cloning and assigning colors
                colorPalettes.forEach((palette, index) => __awaiter(this, void 0, void 0, function* () {
                    let newFrame = frame.clone();
                    // Determine spacing conditionally
                    const offsetX = frame.width > paletteWidth ? frame.width + minSpacing : paletteWidth + minSpacing + 300;
                    newFrame.x = frame.x + (index + 1) * offsetX;
                    newFrame.name = `Palette Frame ${index + 1}`;
                    console.log(`Frame ${newFrame.name} created`);
                    const allLayers = newFrame.findAll();
                    const layers = allLayers.map((layer, idx) => {
                        const newName = `${layer.name}_${index}_${idx}`; // Create a new unique name
                        layer.name = newName; // Update the layer name directly
                        console.log(`Updated Layer Name: ${newName}`); // Log the updated name
                        // Use the getLayerColor function to extract the color from the layer
                        const color = getLayerColor(layer);
                        return { name: newName, color: color };
                    });
                    layers.reverse();
                    // Log the palette being applied to each frame
                    console.log(`Applying colors to Frame ${newFrame.name}:`, palette);
                    assignColorsToLayers(layers, palette, index);
                    // Load font before creating the text node
                    yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
                    // Create a text node above the frame
                    const textNode = figma.createText();
                    textNode.characters = frameTitles[index % frameTitles.length]; // Assign respective title
                    textNode.fontSize = 128; // Set font size
                    textNode.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
                    textNode.x = newFrame.x + newFrame.width / 2 - textNode.width / 2; // Center above the frame
                    textNode.y = newFrame.y - 350; // Position above the frame
                    textNode.name = `Title: ${textNode.characters}`;
                    figma.currentPage.appendChild(textNode);
                    // Display the color palette under each frame
                    const paletteOffsetY = newFrame.y + newFrame.height + 20; // Position the palette rectangles below the frame
                    palette.forEach((color, colorIndex) => {
                        const rect = figma.createRectangle();
                        rect.x = newFrame.x + colorIndex * 90; // Adjust spacing to prevent overlap
                        rect.y = paletteOffsetY;
                        rect.resize(80, 80); // Increase size for each color rectangle
                        rect.fills = [{ type: "SOLID", color: hexToRgb(color), boundVariables: {} }];
                        rect.name = `Color ${colorIndex + 1} - ${color}`;
                        figma.currentPage.appendChild(rect);
                        console.log(`Added color display for ${color} under Frame ${newFrame.name}`);
                    });
                }));
                figma.notify("Color assignment completed.");
            }
            catch (error) {
                console.error("Error retrieving or assigning palettes:", error);
                figma.notify("An error occurred during color assignment.");
            }
        }
    });
}
function hexToRgbValues(hex) {
    const bigint = parseInt(hex.slice(1), 16); // Convert hex to decimal
    const r = (bigint >> 16) & 255; // Extract red component
    const g = (bigint >> 8) & 255; // Extract green component
    const b = bigint & 255; // Extract blue component
    return [r, g, b]; // Return RGB values as an array
}
// Function to assign colors to layers
function assignColorsToLayers(layers, colorPalette, index) {
    return __awaiter(this, void 0, void 0, function* () {
        const methods = ["http://localhost:5000/assign_colors", "http://localhost:5000/assign_colors_pl", "http://localhost:5000/assign_colors_sq"];
        const palette = colorPalette.map(hexToRgbValues);
        console.log('Layers', layers);
        try {
            const response = yield fetch(methods[index % 3], {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    layers: layers,
                    palette: palette,
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const assignment = yield response.json();
            console.log("Color Assignment:", assignment);
            for (const layerName in assignment) {
                if (assignment.hasOwnProperty(layerName)) {
                    const colorValues = assignment[layerName]; // Get the RGB values for the current layer
                    console.log("Color Values:", colorValues);
                    console.log("Layer Name:", layerName);
                    if (layerName === "main") {
                        continue;
                    }
                    // Convert the RGB values to Figma's color format (normalized between 0-1)
                    const [r, g, b] = colorValues;
                    const rgbColor = { r: r / 255, g: g / 255, b: b / 255 };
                    // Find the layer in Figma by its name
                    const figmaLayer = figma.currentPage.findOne((node) => node.name === layerName);
                    if (!figmaLayer) {
                        console.error(`Layer "${layerName}" not found.`);
                    }
                    else {
                        console.log(`Layer "${layerName}" found! Proceeding with color assignment.`);
                    }
                    if (figmaLayer && "fills" in figmaLayer) {
                        // Get the current fills and make a copy (since fills are readonly)
                        const fills = JSON.parse(JSON.stringify(figmaLayer.fills));
                        if (fills.length > 0) {
                            // Loop through each fill and only change the color if it's relevant
                            fills.forEach((fill) => {
                                if (fill.type === "SOLID") {
                                    // Create a new object by spreading the existing fill and assigning the new color
                                    const newSolidFill = Object.assign(Object.assign({}, fill), { color: rgbColor });
                                    // Replace the old fill with the new one
                                    fills[0] = newSolidFill;
                                }
                                else if (fill.type === "GRADIENT_LINEAR" ||
                                    fill.type === "GRADIENT_RADIAL" ||
                                    fill.type === "GRADIENT_ANGULAR" ||
                                    fill.type === "GRADIENT_DIAMOND") {
                                    // Create a new gradientStops array by adjusting each stop's color relative to its position
                                    const newGradientStops = fill.gradientStops.map((stop) => {
                                        const blendedColor = blendColors(stop.color, rgbColor, stop.position); // Blend the original color with the new RGB color based on position
                                        return Object.assign(Object.assign({}, stop), { color: {
                                                r: blendedColor.r,
                                                g: blendedColor.g,
                                                b: blendedColor.b,
                                                a: stop.color.a, // Preserve the original alpha value
                                            } });
                                    });
                                    // Create a new GradientPaint object and replace the fill with this new object
                                    const newGradientFill = {
                                        type: fill.type,
                                        gradientTransform: fill.gradientTransform,
                                        gradientStops: newGradientStops, // The new gradient stops array
                                        opacity: fill.opacity,
                                        visible: fill.visible,
                                        blendMode: fill.blendMode,
                                    };
                                    // Replace the original fill in the fills array
                                    fills[0] = newGradientFill;
                                }
                                else if (fill.type === "IMAGE") {
                                    // If it's an image, you can apply some logic if needed, but usually, we leave image fills intact
                                    console.log(`Layer "${layerName}" has an image fill, skipping color update.`);
                                }
                            });
                            // Assign the modified fills back to the layer
                            figmaLayer.fills = fills;
                        }
                        else {
                            console.log(`Layer "${layerName}" has no fills.`);
                        }
                        console.log(`Layer "${layerName}" color updated to RGB: ${r}, ${g}, ${b}`);
                    }
                    else if (figmaLayer && "stroke" in figmaLayer) {
                        // For layers with strokes (e.g., vectors), update the stroke color
                        const strokes = JSON.parse(JSON.stringify(figmaLayer.stroke)); // Note: it should be 'strokes', not 'stroke'
                        if (strokes.length > 0 && strokes[0].type === "SOLID") {
                            // Create a new SolidPaint object by copying the existing properties and replacing the color
                            const newStroke = Object.assign(Object.assign({}, strokes[0]), { color: rgbColor });
                            // Replace the first stroke with the new stroke
                            strokes[0] = newStroke;
                            figmaLayer.stroke = strokes; // Assign the modified strokes back to the layer
                        }
                        console.log(`Layer "${layerName}" stroke color updated to RGB: ${r}, ${g}, ${b}`);
                    }
                    else {
                        console.log(`Layer "${layerName}" not found or does not support fills or strokes.`);
                    }
                }
            }
            // Notify the user that the process is done
            figma.notify("Colors have been successfully assigned to layers.");
        }
        catch (error) {
            console.error("Error:", error);
        }
    });
}
// Function to blend two colors based on a given ratio (0 to 1)
function blendColors(originalColor, newColor, position) {
    const blendFactor = position; // The position in the gradient (0 to 1)
    return {
        r: originalColor.r * (1 - blendFactor) + newColor.r * blendFactor,
        g: originalColor.g * (1 - blendFactor) + newColor.g * blendFactor,
        b: originalColor.b * (1 - blendFactor) + newColor.b * blendFactor,
    };
}
// Function to calculate the average color of the layers
function calculateAverageColor(layers) {
    let totalColor = { r: 0, g: 0, b: 0 };
    let count = 0;
    layers.forEach((layer) => {
        if ("fills" in layer &&
            Array.isArray(layer.fills) &&
            layer.fills.length > 0) {
            const fill = layer.fills[0];
            if (fill.type === "SOLID") {
                totalColor.r += fill.color.r;
                totalColor.g += fill.color.g;
                totalColor.b += fill.color.b;
                count++;
            }
        }
    });
    return count > 0
        ? {
            r: totalColor.r / count,
            g: totalColor.g / count,
            b: totalColor.b / count,
        }
        : { r: 0, g: 0, b: 0 };
}
// Function to calculate the Euclidean distance between two colors
function getColorDistance(color1, color2) {
    return Math.sqrt(Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2));
}
// Function to find the closest color from the palette
function findClosestColor(layerColor, palette) {
    let closestColor = { r: 0, g: 0, b: 0 };
    let minDistance = Infinity;
    palette.forEach((colorHex) => {
        const paletteColor = hexToRgb(colorHex);
        const distance = getColorDistance(layerColor, paletteColor);
        if (distance < minDistance) {
            closestColor = paletteColor;
            minDistance = distance;
        }
    });
    return closestColor;
}
// Function to assign colors to layers based on proximity to average color
function assignColorsBasedOnProximity(layers, colorPalette) {
    return __awaiter(this, void 0, void 0, function* () {
        // Extract the layer names
        const layerNames = layers.map((layer) => layer.name);
        // Retrieve all SceneNode layers that match the names provided
        const sceneNodes = figma.currentPage.findAll((node) => layerNames.includes(node.name) && "fills" in node);
        if (sceneNodes.length === 0) {
            figma.notify("No matching layers with color fills found by name.");
            return;
        }
        // Calculate the average color for these layers
        const averageColor = calculateAverageColor(sceneNodes);
        // Assign the closest color to each layer
        sceneNodes.forEach((layer) => {
            if ("fills" in layer &&
                Array.isArray(layer.fills) &&
                layer.fills.length > 0) {
                const layerFill = layer.fills[0];
                if (layerFill.type === "SOLID") {
                    const layerColor = layerFill.color;
                    const closestColor = findClosestColor(layerColor, colorPalette);
                    // Apply the closest color to the layer
                    layer.fills = [{ type: "SOLID", color: closestColor }];
                }
                else if (layerFill.type === "SOLID") {
                }
                //
                //
            }
        });
        figma.notify("Colors assigned based on proximity to average color!");
    });
}
