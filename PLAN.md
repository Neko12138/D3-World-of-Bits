# D3: No Game No Life

Game Design Vision

{a few-sentence description of the game mechanics}

Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

### D3.a Core Mechanics

Key technical challenge: Implement a deterministic map-based system using Leaflet where each grid cell’s content (token presence and value) is visible and consistent across page loads.\
Key gameplay challenge: Players can collect and craft nearby tokens to create higher-value ones, with clear inventory feedback and limited interaction range.

#### D3.a Steps

##### 1. Setup & Map Initialization

- [x] Backup existing `main.ts` to `reference.ts` for future reference
- [x] Clear all contents in `main.ts`
- [x] Import and initialize a basic Leaflet map centered on the classroom location
- [x] Add player marker to indicate the fixed player position
- [x] Lock map panning/zoom to reasonable limits (player-centered view)

##### 2. Grid Rendering

- [x] Define grid parameters (e.g. cell size ≈ 0.0001 degrees)
- [x] Implement loops to render visible grid cells around player position
- [x] Display each cell as a rectangle or marker on the map
- [x] Use deterministic hashing (Luck library) to decide if a cell contains a token, and its value
- [x] Display token info (value or symbol) directly on the cell without clicking

##### 3. Interaction Mechanics

- [x] Implement click handling on cells
- [x] Restrict interactions to cells within ~3 cells of player
- [x] On click: pick up a token if available and none is currently held
- [x] Remove token from cell when picked up
- [x] Display current held token and its value on the screen (inventory UI)

##### 4. Crafting System

- [x] If player has a token, allow placing it on a cell with a token of equal value
- [x] On placement: remove both tokens and create a new token with double value
- [x] Update UI to reflect new token or empty hand
- [x] Detect and notify when player obtains a high-value token (e.g. 8 or 16)

##### 5. Persistence & Determinism

- [x] Ensure token spawning is deterministic (Luck function or seeded hash)
- [x] Ensure cell contents are consistent across page reloads
- [x] Keep player inventory persistent during a session

### D3.b Globe-spanning Gameplay

Key technical challenge: Implement a global, coordinate-based grid system in Leaflet that dynamically spawns and despawns cells as the player moves or pans the map.
Key gameplay challenge: Allow players to explore a memoryless, earth-scale environment, collecting and crafting tokens across dynamically generated cells.

#### D3.b Steps

##### 1. Map & Movement Controls

- [x] Add directional buttons (North, South, East, West) to simulate local player movement
- [x] Implement map panning and zooming while keeping the view centered on the player or manual scroll position
- [x] Use Leaflet’s moveend event to detect when map movement has finished

##### 2. Global Coordinate & Cell System

- [x] Define a grid cell data structure to represent global cells
- [x] Implement functions to convert latitude–longitude pairs to cell identifiers, and vice versa
- [x] Anchor the coordinate system at Null Island (0° latitude, 0° longitude)

##### 3. Dynamic Cell Rendering

- [x] Generate and display all visible cells within the current map bounds
- [x] Spawn new cells when they enter the visible area and remove cells when they leave it
- [x] Ensure the visible area always remains fully covered by grid cells

##### 4. Interaction & Memoryless Behavior

- [x] Restrict player interaction to nearby cells
- [x] Make cells “memoryless” — reset their contents once they leave the visible area
- [x] Allow players to repeatedly collect tokens by moving in and out of visible cell ranges

##### 5. Crafting & Victory Condition

- [x] Extend the existing token collection and crafting mechanics across the global map
- [x] Define a higher-value crafting goal
- [x] Display a clear victory message once the target token value is reached

### D3.c Object Persistence

Key technical challenge: Implement a lightweight, memory-efficient grid system where unmodified cells do not consume memory, while modified cells are automatically saved and restored using a Memento-style state storage.

Key gameplay challenge: Make the world feel persistent: tokens placed, removed, or merged by the player should “stay changed” even after the player scrolls away and returns — while still allowing infinite map exploration.

#### D3.c Steps

##### 1. Introduce a Persistent modifiedCells Map

- [x] Separate “real stored state” from “temporary rendered state.”
- [x] Unmodified cells remain completely “flyweight” and are regenerated with luck() whenever they appear.

##### 2. Implement Memento save/restore

- [x] Whenever a cell scrolls off-screen, save its state if it deviates from the default procedural state.
- [x] Restore logic (Memento restoration)
- [x] When a new cell enters view check if this cell exists in modifiedCells.

##### 3. Refactor rendering: rebuild the screen purely from stored + procedural data

- [x] Rendering must be deterministic and stateless.
- [x] On each update remove any marker/rect not in visible range
- [x] Ensures scrolling the map always reconstructs correct world state.

##### 4. Integrate persistence into player actions

- [x] Any action that changes a cell must update modifiedCells.
- [x] All changes are stored in modifiedCells
- [x] Prevent duplicating tokens when leaving & returning

D3.d: World of Bits, Gameplay Across Real-world Space and Time

Key technical challenge: Design a unified, interface-driven movement system where different input methods (buttons or geolocation) can be swapped seamlessly behind a Facade, while game state—including player position and cell modifications—is persistently stored and restored using localStorage.

Key gameplay challenge: Enable players to move through the world by physically moving in real space, while ensuring their progress, tokens, and position persist across sessions and allowing them to freely toggle between traditional button controls and real-world geolocation movement.

#### D3.d Steps

##### 1. Introduce a Movement Control Facade

- [x] Define a unified `IMovmentController` interface to abstract all movement methods.
- [x] Implement `ButtonMovementController` to encapsulate button movement logic.
- [x] Implement `GeoMovementController` to encapsulate geolocation movement logic.
- [x] Create `MovementFacade` to provide a unified source of movement events.
- [x] Modify the game's main loop to depend only on `MovementFacade`, not on specific control methods.
- [x] Migrate existing button events into the internal logic of `ButtonMovementController`.

##### 2. Add Real-world Movement via Geolocation

- [x] Retrieves the player's real-world location from the browser's geolocation API.
- [x] Converts real-world displacement into game-world coordinate changes.
- [x] Triggers Facade movement events when geographic coordinates change.
- [x] Allows geolocation controls to be enabled or disabled at any time.

##### 3. Persist Game State in localStorage

- [x] Save playerI, playerJ, heldToken, modifiedCells, and movementMode using localStorage.
- [x] Restore all states from localStorage when the game starts.
- [x] Save the current state immediately after a player moves.
- [x] Save the state immediately after picking up or placing a token.
- [x] Save settings immediately after switching movement modes.

##### 4. Add Ability to Start a New Game

- [x] Add a "New Game" button to the control panel.
- [x] Clicking it will clear all save data in localStorage.
- [x] Reset the player's position, inventory, and modified cells.
- [x] Re-render the map and the player's initial state.

##### 5. Support Switching Movement Mode

- [x] Allows specifying button or geolocation mode via a URL query string.
- [x] Allows switching movement modes by clicking a button on the interface.
- [x] Disables the old controller and launches the new controller when switching modes.
- [x] Saves the current control mode to localStorage.
- [x] The UI shows or hides the button control panel based on the mode.

##### 6. Integrate D3.d features into Rendering & Logic

- [x] Player movement is entirely event-driven by MovementFacade.
- [x] Keep updateGrid and updatePlayerMarker independent of the control method.
- [x] Geolocation updates trigger rendering and state saving processes.
- [x] The move button is automatically hidden in geolocation mode.
- [x] Dragging and zooming the map still triggers grid reconstruction logic.
