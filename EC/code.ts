figma.showUI(__html__, { width: 430, height: 560 });

// Handle messages received from the HTML page
figma.ui.onmessage = async (msg: { type: string; value: string }) => {
  // if (msg.type === 'select-frame') {
  //   await handleSelectFrameMessage();
  // } else
  if (msg.type === "create-palette") {
    await handleCreatePaletteMessage();
  } else if (msg.type === "assign-color") {
    await handleAssignColorMessage(msg);
  } else if (msg.type === "generate-palette-ai") {
    await handleCreatePaletteAiVersion(msg.value);
  } else if (msg.type === "recolor-frame-ai") {
    await handleAssignColorAIVersion(msg.value);
  }
};

// Function to handle the 'select-frame' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function handleSelectFrameMessage() {
  const selectedFrames = figma.currentPage.selection.filter(
    (node) => node.type === "FRAME"
  );

  if (selectedFrames.length === 0) {
    figma.notify("Please select a frame on the canvas.");
    return;
  }

  // Assuming you want to work with the first selected frame
  const selectedFrame = selectedFrames[selectedFrames.length - 1] as FrameNode;

  figma.notify(`Frame "${selectedFrame.name}" selected.`);
  console.log("Frame Selected: " + selectedFrame.name);

  // Store the selected frame globally if needed
  figma.root.setPluginData("selectedFrameId", selectedFrame.id);
}

// Function to handle the 'create-palette' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function handleCreatePaletteMessage() {
  handleSelectFrameMessage();
  const frameId = figma.root.getPluginData("selectedFrameId");

  if (!frameId) {
    figma.notify("No frame selected. Please select a frame first.");
    return;
  }

  try {
    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || node.type !== "FRAME") {
      figma.notify("Selected frame is no longer available or is not a frame.");
      return;
    }

    const frame = node as FrameNode;

    // Export the frame as JPEG
    const jpegBytes = await exportFrameAsJPEG(frame);
    console.log("JPEG Bytes:", jpegBytes); // Log the output to verify

    // Modify the type of colorPalettes to expect an array of arrays
    try {
      const colorPalettes = await sendToAPI(jpegBytes);
      console.log("TEST palettes:", colorPalettes); // Ensure this logs the correct structure
     // createColorPaletteOnCanvas(colorPalettes);
    } catch (error) {
      console.error("Error in sending to API:", error); // Log the error if it occurs
    }
  } catch (error) {
    console.error("Error details:", error); // Log the error details
    figma.notify(
      "An error occurred while exporting the image or sending it to the API."
    );
  }
}

async function fetchAIColorPalette(prompt: string) {
  try {
    // Construct the prompt
    prompt +=
      " And make sure the colors are not too similar to each other and used together to create a beautiful design." +
      " Also, the color palette must consist of 5 colors " +
      " and make sure to return the color codes of the color palette in hex format " +
      " and return only the color codes in the response, do not return text or anything else.";

    // Make the API request
    const response = await fetch("http://127.0.0.1:5000/process_prompt", {
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
    const data = await response.json();

    // Split the color codes string into a list and return it
    const colorCodesList = data.palette.trim().split(/\s+/); // Splitting by whitespace
    return colorCodesList;
  } catch (error) {
    console.error(error);
    figma.notify("An error occurred while sending the request to the API.");
    return []; // Return an empty array in case of error
  }
}

async function handleCreatePaletteAiVersion(prompt: string) {
  try {
    const colorCodesList = await fetchAIColorPalette(prompt);
    console.log(colorCodesList);
    // Log the list of color codes
    createColorPaletteOnCanvasAI(colorCodesList);
    // console.log("Color Codes List:", colorCodesList);
  } catch (error) {
    console.error(error);
    figma.notify("An error occurred while sending the request to the API.");
  }
}

async function selectFrameLayers() {
  handleSelectFrameMessage();
  const frameId = figma.root.getPluginData("selectedFrameId");
  if (!frameId) {
    figma.notify("No frame selected. Please select a frame first.");
    return []; // Return an empty array if no frame is selected
  }

  const node = await figma.getNodeByIdAsync(frameId);
  if (!node || node.type !== "FRAME") {
    figma.notify("Selected frame is no longer available or is not a frame.");
    return []; // Return an empty array if the selected node is invalid
  }

  const frame = node as FrameNode;
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
}


async function handleAssignColorAIVersion(prompt: string) {
  try {
    const layers = await selectFrameLayers();
    const colorCodesList = await fetchAIColorPalette(prompt);
   //assignColorsToLayers(layers, colorCodesList,1);
  } catch (error) {
    console.error(error);
    figma.notify("An error occurred while sending the request to the API.");
  }
}
// Function to export a frame as JPEG
async function exportFrameAsJPEG(frame: FrameNode): Promise<Uint8Array> {
  const imageData = await frame.exportAsync({ format: "JPG" });
  return imageData;
}

// Function to send the JPEG image data to the API and return the color palette
async function sendToAPI(imageData: Uint8Array): Promise<string[]> {
  console.log("Sending image to API...");
  const response = await fetch("http://localhost:5000/process_image", {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg", // Ensure this matches the format you are sending
    },
    body: imageData,
  });
  //console.log("API response:", response);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send image to API: ${response.statusText}, ${errorText}`
    );
  }

  const result = await response.json();
  //console.log("API response:", result); // Log the API response
  // console.log("Color palettes:", result.color_palettes);
  figma.notify("Image exported and palette received successfully.");
  //  console.log("Color palettes from API:", result.color_palettes);
  return result.color_palettes; // Change this to get the array of arrays from the API
}

async function createColorPaletteOnCanvasAI(colorPalette: string[]) {
  const nodes: SceneNode[] = [];
  const selection = figma.currentPage.selection;

  if (selection.length === 0 || selection[0].type !== "FRAME") {
    figma.notify("Please select a frame first.");
    return;
  }

  const selectedFrame = selection[0] as FrameNode; // Cast to FrameNode
  const startX = selectedFrame.x; // Frame's X position
  const startY = selectedFrame.y; // Frame's Y position
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  colorPalette.forEach((color, index) => {
    const text = figma.createText();
    figma.currentPage.appendChild(text); 
    text.x = startX; // Align with the first color
    text.y = startY -210 // Position above the palette
    
    text.characters = `AI generated palette`;
    text.fontSize = 26;
    text.fontName = { family: "Inter", style: "Regular" };
    text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    nodes.push(text);

    const rect = figma.createRectangle();
    rect.x = startX + index * 110; // Position rectangles with some spacing
    rect.y = startY-170;
    rect.resize(100, 100);
    rect.fills = [
      { type: "SOLID", color: hexToRgb(color), boundVariables: {} },
    ];

    figma.currentPage.appendChild(rect);
    nodes.push(rect);
  });

  figma.currentPage.selection = nodes;
}

async function createColorPaletteOnCanvas(colorPalettes: string[][]) {
  const nodes: SceneNode[] = [];

  const selection = figma.currentPage.selection;

  if (selection.length === 0 || selection[0].type !== "FRAME") {
    figma.notify("Please select a frame first.");
    return;
  }

  const selectedFrame = selection[0] as FrameNode; // Cast to FrameNode
  const startX = selectedFrame.x; // Frame's X position
  const startY = selectedFrame.y+800; // Frame's Y position

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  colorPalettes.forEach((palette, paletteIndex) => {

    // Create a text label for each palette
    const text = figma.createText();
    figma.currentPage.appendChild(text); 
    text.x = startX; // Align with the first color
    text.y =  (startY + paletteIndex * 150)-30 // Position above the palette
    
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
}
// Helper function to convert hex color to RGB
function hexToRgb(hex: string): RGB {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r: r / 255, g: g / 255, b: b / 255 };
}

//Function to get Color from layer
function getLayerColor(layer: SceneNode): number[] {
  let color = [0, 0, 0]; // Default color (black)

  // Type narrowing for layers that have fills
  if ('fills' in layer && Array.isArray(layer.fills) && layer.fills.length > 0) {
    const fill = layer.fills[0];

    // Make sure the fill is a valid Solid color type
    if (fill.type === 'SOLID') {
      const { r, g, b } = fill.color;
      color = [r * 255, g * 255, b * 255];
    } else if (
      fill.type === 'GRADIENT_LINEAR' ||
      fill.type === 'GRADIENT_RADIAL' ||
      fill.type === 'GRADIENT_ANGULAR' ||
      fill.type === 'GRADIENT_DIAMOND'
    ) {
      const gradientStop = fill.gradientStops[0]?.color;
      if (gradientStop) {
        const { r, g, b } = gradientStop;
        color = [r * 255, g * 255, b * 255];
      }
    } else if (fill.type === 'IMAGE') {
      console.log(`Layer "${layer.name}" has an image fill, skipping color extraction.`);
    }
  }

  return color; // Return color as an array [r, g, b]
}

// Function to handle the 'assign-color' message
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function handleAssignColorMessage(msg: { type: string }) {
  if (msg.type === "assign-color") {
    handleSelectFrameMessage();
    const frameId = figma.root.getPluginData("selectedFrameId");
    if (!frameId) {
      figma.notify("No frame selected. Please select a frame first.");
      return;
    }

    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || node.type !== "FRAME") {
      figma.notify("Selected frame is no longer available or is not a frame.");
      return;
    }

    const frame = node as FrameNode;
    figma.notify(`Frame "${frame.name}" selected.`);

    // Export the frame as JPEG
    const jpegBytes = await exportFrameAsJPEG(frame);

    try {
      const colorPalettes: string[] = await sendToAPI(jpegBytes);
      console.log(colorPalettes);

      if (!Array.isArray(colorPalettes) || colorPalettes.length === 0) {
        figma.notify("No palettes received from the API.");
        return;
      }
      let newFrame = frame.clone();


      const offsetX = 1300;
      newFrame.x = frame.x + 1 * offsetX;

      newFrame.name = `Palette Frame ${+ 1}`;

      const allLayers = newFrame.findAll();
      //allLayers.reverse();
      
      //const palette = ["#62442C", "#D9914A", "#E7D8C7", "#DBDADA"];
      let assignedColors = assignColors(allLayers, colorPalettes);
      assignedColors = adjustColorsForContrast(assignedColors, allLayers);
      
      
      console.log("Final Assigned Colors:", assignedColors);

   
     assignColorsToLayers(assignedColors);


    } catch (error) {
      console.error("Error retrieving or assigning palettes:", error);
      figma.notify("An error occurred during color assignment.");
    }
  }
}

function hexToRgbValues(hex: string): RGB {
  if (typeof hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    console.error("Invalid hex color received:", hex);
    return { r: 0, g: 0, b: 0 }; // Default fallback
}
  const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255,
    };
}

function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}


// Adjust gradient stops while preserving original lightness shape
function applyGradientStructureToColor(originalStops: ReadonlyArray<ColorStop>, targetHex: string): ColorStop[] {
  const baseLAB = hexToLAB(targetHex);
  const originalLABs = originalStops.map(s => hexToLAB(rgbToHex(s.color)));
  const avgLightness = originalLABs.reduce((sum, c) => sum + c.l, 0) / originalLABs.length;

  return originalLABs.map((originalLAB, i) => {
      const lDiff = originalLAB.l - avgLightness;
      const adjustedLAB = { l: baseLAB.l + lDiff, a: baseLAB.a, b: baseLAB.b };
      const hex = labToHex(adjustedLAB);
      const { r, g, b } = hexToRgbValues(hex);

      return {
          position: originalStops[i].position,
          color: {
              r: r / 255,
              g: g / 255,
              b: b / 255,
              a: originalStops[i].color.a,
          },
      };
  });
}

// Function to assign colors to layers
async function assignColorsToLayers(assignment: { [key: string]: string }) {
 
  try {
    for (const layerName in assignment) {
        if (layerName === "main") {
          continue;
        }
        // Convert the RGB values to Figma's color format (normalized between 0-1)
        const hexColor = assignment[layerName];
        const rgb = hexToRgbValues(hexColor);
        const rgbColor: RGB = { r: rgb.r / 255, g: rgb.g / 255, b: rgb.b / 255 };

        // Find the layer in Figma by its name
        const figmaLayer = figma.currentPage.findOne((node) => node.id === layerName);

        if (!figmaLayer) {
          console.error('Layer "${layerName}" not found.');
        } else {
          console.log(
            'Layer "${layerName}" found! Proceeding with color assignment.'
          );
        }

        if (figmaLayer && "fills" in figmaLayer) {
          // Get the current fills and make a copy (since fills are readonly)
          const fills: Paint[] = JSON.parse(JSON.stringify(figmaLayer.fills));

          if (fills.length > 0) {
            // Loop through each fill and only change the color if it's relevant
            fills.forEach((fill: Paint) => {
              if (fill.type === "SOLID") {
                // Create a new object by spreading the existing fill and assigning the new color
                const newSolidFill: SolidPaint = {
                  ...fill,
                  color: rgbColor,
                };

                // Replace the old fill with the new one
                fills[0] = newSolidFill;
              } else if (
                fill.type === "GRADIENT_LINEAR" ||
                fill.type === "GRADIENT_RADIAL" ||
                fill.type === "GRADIENT_ANGULAR" ||
                fill.type === "GRADIENT_DIAMOND"
              ) {
                const newGradientStops = applyGradientStructureToColor([...fill.gradientStops], hexColor);

                const newGradientFill: GradientPaint = {
                  type: fill.type,
                  gradientTransform: fill.gradientTransform,
                  gradientStops: newGradientStops,
                  opacity: fill.opacity,
                  visible: fill.visible,
                  blendMode: fill.blendMode,
                };
              
                fills[0] = newGradientFill;
              } else if (fill.type === "IMAGE") {
                // If it's an image, you can apply some logic if needed, but usually, we leave image fills intact
                console.log(
                  `Layer "${layerName}" has an image fill, skipping color update.`
                );
              }
            });
            // Assign the modified fills back to the layer
            figmaLayer.fills = fills;
          } else {
            console.log(`Layer "${layerName}" has no fills.`);
          }
          console.log(
            'Layer "${layerName}" color updated to RGB: ${r}, ${g}, ${b}'
          );
        } else if (figmaLayer && "stroke" in figmaLayer) {
          // For layers with strokes (e.g., vectors), update the stroke color
          const strokes: Paint[] = JSON.parse(
            JSON.stringify(figmaLayer.stroke)
          ); // Note: it should be 'strokes', not 'stroke'

          if (strokes.length > 0 && strokes[0].type === "SOLID") {
            // Create a new SolidPaint object by copying the existing properties and replacing the color
            const newStroke: SolidPaint = {
              ...strokes[0], // Spread existing stroke properties
              color: rgbColor, // Update the color
            };

            // Replace the first stroke with the new stroke
            strokes[0] = newStroke;
            figmaLayer.stroke = strokes; // Assign the modified strokes back to the layer
          }

          console.log(
            'Layer "${layerName}" stroke color updated to RGB: ${r}, ${g}, ${b}'
          );
        } else {
          console.log(
            `Layer "${layerName}" not found or does not support fills or strokes.`
          );
        }
      }
      // Notify the user that the process is done
    figma.notify("Colors have been successfully assigned to layers.");
    }
    catch (error) {
      console.error("Error:", error);
    }
  } 

// Converts hex to LAB for perceptual distance
function hexToLAB(hex: string): { l: number, a: number, b: number } {
  const { r, g, b } = hexToRgbValues(hex);
  const [r_, g_, b_] = [r, g, b].map(v => {
      const c = v / 255;
      return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  });

  const x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) / 0.95047;
  const y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) / 1.00000;
  const z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);

  return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
  };
}

// Computes the average LAB color
function averageLAB(palette: { l: number, a: number, b: number }[]): { l: number, a: number, b: number } {
  const total = palette.length;
  return {
      l: palette.reduce((sum, c) => sum + c.l, 0) / total,
      a: palette.reduce((sum, c) => sum + c.a, 0) / total,
      b: palette.reduce((sum, c) => sum + c.b, 0) / total,
  };
}

// Euclidean distance in LAB space
function deltaE(c1: { l: number, a: number, b: number }, c2: { l: number, a: number, b: number }): number {
  return Math.sqrt((c1.l - c2.l) ** 2 + (c1.a - c2.a) ** 2 + (c1.b - c2.b) ** 2);
}

// Sorts colors by perceptual proximity to average in CIELAB (ascending distance)
function sortByDistance(palette: string[]): string[] {
  const labPalette = palette.map(hexToLAB);
  const avg = averageLAB(labPalette);
  return palette
      .map((hex, i) => ({ hex, distance: deltaE(hexToLAB(hex), avg) }))
      .sort((a, b) => a.distance - b.distance)
      .map(entry => entry.hex);
}

// Check if two SceneNodes overlap
function doNodesOverlap(node1: SceneNode, node2: SceneNode): boolean {
  const node1Bounds = node1.absoluteBoundingBox;
  const node2Bounds = node2.absoluteBoundingBox;

  if (!node1Bounds || !node2Bounds) {
      return false;
  }

  return !(
      node1Bounds.x + node1Bounds.width <= node2Bounds.x ||
      node1Bounds.x >= node2Bounds.x + node2Bounds.width ||
      node1Bounds.y + node1Bounds.height <= node2Bounds.y ||
      node1Bounds.y >= node2Bounds.y + node2Bounds.height
  );
}

// Calculates luminance for contrast ratio
function calculateLuminance({ r, g, b }: RGB): number {
  const [R, G, B] = [r, g, b].map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Calculates contrast ratio between two colors
function calculateContrast(color1: RGB, color2: RGB): number {
  const luminance1 = calculateLuminance(color1);
  const luminance2 = calculateLuminance(color2);
  const brightest = Math.max(luminance1, luminance2);
  const darkest = Math.min(luminance1, luminance2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function labToHex(lab: { l: number, a: number, b: number }): string {
  const y = (lab.l + 16) / 116;
  const x = lab.a / 500 + y;
  const z = y - lab.b / 200;

  const f = (t: number) => {
      const t3 = t ** 3;
      return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  let X = f(x) * 0.95047;
  let Y = f(y) * 1.00000;
  let Z = f(z) * 1.08883;

  const rgb = [
      X *  3.2406 + Y * -1.5372 + Z * -0.4986,
      X * -0.9689 + Y *  1.8758 + Z *  0.0415,
      X *  0.0557 + Y * -0.2040 + Z *  1.0570
  ].map(c => {
      const val = c <= 0.0031308 ? 12.92 * c : 1.055 * (Math.pow(c, 1 / 2.4)) - 0.055;
      return Math.max(0, Math.min(255, Math.round(val * 255)));
  });

  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

// Adjust lightness in LAB for low contrast overlaps (gradient-aware)
function adjustColorsForContrast(assignment: { [key: string]: string }, nodes: SceneNode[], minLightnessDiff: number = 120): { [key: string]: string } {
  const adjusted = { ...assignment };

  const getEffectiveLightness = (hex: string, node: SceneNode): number => {
    const paint = 'fills' in node && Array.isArray(node.fills) ? node.fills[0] : null;
    if (paint && paint.type && paint.type.startsWith("GRADIENT") && 'gradientStops' in paint) {
      const avgL = (paint.gradientStops as ColorStop[]).map((stop: ColorStop) => hexToLAB(rgbToHex(stop.color)).l);
      return avgL.reduce((a, b) => a + b, 0) / avgL.length;
    }
    return hexToLAB(hex).l;
  };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (!doNodesOverlap(nodes[i], nodes[j])) continue;

      const top = nodes[j];
      const bottom = nodes[i];

      const topHex = adjusted[top.id];
      const bottomHex = adjusted[bottom.id];
      if (!topHex || !bottomHex) continue;

      const topL = getEffectiveLightness(topHex, top);
      const bottomL = getEffectiveLightness(bottomHex, bottom);
      const contrast = Math.abs(topL - bottomL);

      if (contrast >= minLightnessDiff) continue;

      const topLab = hexToLAB(topHex);
      topLab.l = topL <= bottomL ? bottomL + minLightnessDiff : bottomL - minLightnessDiff;
      topLab.l = Math.max(0, Math.min(100, topLab.l));

      adjusted[top.id] = labToHex(topLab);
    }
  }

  return adjusted;
}

// Assign colors to nodes
function assignColors(nodes: SceneNode[], palette: string[]): { [key: string]: string } {  const sortedPalette = sortByDistance(palette);
  const assignment: { [key: string]: string } = {};
  console.log('sorted Palette ' + sortedPalette);
  assignment[nodes[0].id] = sortedPalette[0];
  sortedPalette.slice(1);
  
  for (let i = 1; i < nodes.length; i++) {
    assignment[nodes[i].id] = sortedPalette[i % sortedPalette.length];
  }

  return assignment;
}

function setFrameFill(frame: FrameNode, colorHex: string) {
  const { r, g, b } = hexToRgbValues(colorHex);

  const newFill: SolidPaint = {
      type: "SOLID",
      color: { r: r / 255, g: g / 255, b: b / 255 },
  };
  console.log(newFill);
  
  frame.fills = [newFill]; // Assign the new fill to the frame
}