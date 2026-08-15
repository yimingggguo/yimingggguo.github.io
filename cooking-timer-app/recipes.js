// Recipe definitions for the steak timer.
// Each recipe is a sequence of timed steps. The engine in app.js just
// walks through `steps` in order, so adding a new cut of steak later
// is a matter of adding another entry here.

const RECIPES = {
  "cote-de-boeuf": {
    name: "Côte de Boeuf",
    subtitle: "Bone-in ribeye, high heat sear",
    description: "Cook until desired internal temperature.",
    steps: [
      { label: "Sear a side", duration: 150 },
      { label: "Sear the same side but rotate", duration: 150 },
      { label: "Flip and sear the other side", duration: 150 },
      { label: "Sear the same side but rotate", duration: 150 },
      { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
	  { label: "Continue cooking", duration: 30 },
      { label: "Continue cooking", duration: 30 },
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
