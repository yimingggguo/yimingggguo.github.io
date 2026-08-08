// Recipe definitions for the steak timer.
// Each recipe is a sequence of timed steps. The engine in app.js just
// walks through `steps` in order, so adding a new cut of steak later
// is a matter of adding another entry here.

const RECIPES = {
  "cote-de-boeuf": {
    name: "Côte de Boeuf",
    subtitle: "Bone-in ribeye, high heat sear",
    description: "6 rotations of 30s, searing each side and edge of the steak.",
    steps: [
      { label: "Sear side 1", duration: 30 },
      { label: "Sear side 2", duration: 30 },
      { label: "Sear side 3", duration: 30 },
      { label: "Sear side 4", duration: 30 },
      { label: "Sear side 5", duration: 30 },
      { label: "Sear side 6", duration: 30 },
    ],
  },

  "medium-rare-cut": {
    name: "Medium Rare Cut",
    subtitle: "Sides then edges, medium-rare finish",
    description: "Sear both sides for 1 minute each, then rotate through all four edges for 30s each.",
    steps: [
      { label: "Sear a side", duration: 60 },
      { label: "Flip and sear the other side", duration: 60 },
      { label: "Sear edge", duration: 30 },
      { label: "Rotate and sear another edge", duration: 30 },
      { label: "Rotate and sear another edge", duration: 30 },
      { label: "Rotate and sear another edge", duration: 30 },
    ],
  },
};
