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

- [ ] Define a grid cell data structure to represent global cells
- [ ] Implement functions to convert latitude–longitude pairs to cell identifiers, and vice versa
- [ ] Anchor the coordinate system at Null Island (0° latitude, 0° longitude)

##### 3. Dynamic Cell Rendering

- [ ] Generate and display all visible cells within the current map bounds
- [ ] Spawn new cells when they enter the visible area and remove cells when they leave it
- [ ] Ensure the visible area always remains fully covered by grid cells

##### 4. Interaction & Memoryless Behavior

- [ ] Restrict player interaction to nearby cells
- [ ] Make cells “memoryless” — reset their contents once they leave the visible area
- [ ] Allow players to repeatedly collect tokens by moving in and out of visible cell ranges

##### 5. Crafting & Victory Condition

- [ ] Extend the existing token collection and crafting mechanics across the global map
- [ ] Define a higher-value crafting goal
- [ ] Display a clear victory message once the target token value is reached
