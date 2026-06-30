/* ===== SEED.JS =====
   The starting skill tree, baked from mathRPG-skills-seed.md at build time.
   Loaded once by core.js on first run (no saved state) to initialize state.skills.
   After first load, the app owns this data — do not re-parse the markdown at runtime.

   masteryXP is precomputed from the seed's starting "mastery level" m via the pinned
   curve in mathrpg-build-plan.md §3: masteryXP = 100 * m * (m+1) / 2
     m=1 -> 100   m=2 -> 300   m=3 -> 600   m=4 -> 1000   m=5 -> 1500

   level = count of roadmap subtopics with done:true (per skill, computed here to match
   the seed file's [x] marks; core.js can recompute this from roadmap after in-app edits).
*/

function rm(title, done) { return { title: title, done: done }; }

const SEED = [
  // ---------- Branch: Algebra ----------
  {
    id: "group-theory", name: "Group Theory", branch: "algebra",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("groups, subgroups, cosets", true),
      rm("homomorphisms & quotient groups", true),
      rm("group actions, orbit–stabilizer", true),
      rm("Sylow theorems", true),
      rm("classification of finite abelian groups", true),
      rm("solvable & nilpotent groups", true),
      rm("free groups & presentations", false),
      rm("representation theory of finite groups", false)
    ],
    level: 6, masteryXP: 1000, lastTouched: null
  },
  {
    id: "ring-commutative-algebra", name: "Ring & Commutative Algebra", branch: "algebra",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("rings, ideals, ring homomorphisms", true),
      rm("modules over a ring", true),
      rm("localization", true),
      rm("Noetherian & Artinian rings", true),
      rm("primary decomposition", true),
      rm("integral extensions", true),
      rm("tensor products of modules", true),
      rm("dimension theory / Nullstellensatz", true)
    ],
    level: 8, masteryXP: 1000, lastTouched: null
  },
  {
    id: "homological-algebra", name: "Homological Algebra", branch: "algebra",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("chain & cochain complexes", true),
      rm("exact sequences, snake lemma", true),
      rm("projective & injective resolutions", true),
      rm("Ext and Tor", true),
      rm("derived functors", true),
      rm("spectral sequences", true),
      rm("derived & triangulated categories", false)
    ],
    level: 6, masteryXP: 600, lastTouched: null,
    synergyNote: "Cohomology of Spaces (Algebraic Topology) needs this branch met + CW complexes."
  },
  {
    id: "category-theory", name: "Category Theory", branch: "algebra",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("categories, functors", true),
      rm("natural transformations", true),
      rm("limits & colimits", true),
      rm("adjoint functors", true),
      rm("Yoneda lemma", true),
      rm("monoidal categories", true),
      rm("string-diagram / graphical calculus", true),
      rm("abelian categories", false),
      rm("enriched & higher categories", false)
    ],
    level: 7, masteryXP: 600, lastTouched: null
  },

  // ---------- Branch: Topology ----------
  {
    id: "point-set-topology", name: "Point-Set Topology", branch: "topology",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("topologies, bases, subspaces", true),
      rm("continuity & homeomorphism", true),
      rm("compactness (incl. Tychonoff)", false),
      rm("connectedness & path-connectedness", false),
      rm("separation axioms (Hausdorff, Urysohn)", false),
      rm("product & quotient topology", false),
      rm("metrization", false),
      rm("nets & filters", false)
    ],
    level: 2, masteryXP: 100, lastTouched: null
  },
  {
    id: "algebraic-topology", name: "Algebraic Topology", branch: "topology",
    classTag: "math", maintenance: false, priorityGrowth: true,
    roadmap: [
      rm("fundamental group π₁", true),
      rm("van Kampen's theorem", false),
      rm("covering spaces", false),
      rm("simplicial & CW complexes", false),
      rm("singular homology", false),
      rm("cohomology of spaces", false),
      rm("cup products & ring structure", false),
      rm("Poincaré duality", false),
      rm("higher homotopy groups", false)
    ],
    level: 1, masteryXP: 100, lastTouched: null,
    synergyNote: "★ Cohomology of Spaces: prereqs Homological Algebra (met) + CW complexes (not yet). Glows when both are met."
  },

  // ---------- Branch: Analysis ----------
  {
    id: "real-analysis", name: "Real Analysis", branch: "analysis",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("metric spaces", true),
      rm("sequences & series", true),
      rm("continuity & uniform convergence", true),
      rm("differentiation", true),
      rm("measure & Lebesgue integration", true),
      rm("Lᵖ spaces", true),
      rm("Banach & Hilbert spaces", true),
      rm("Fourier analysis", false)
    ],
    level: 7, masteryXP: 1000, lastTouched: null
  },
  {
    id: "functional-analysis", name: "Functional Analysis", branch: "analysis",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("normed & Banach spaces", true),
      rm("bounded linear operators", true),
      rm("Hahn–Banach, open mapping, closed graph", false),
      rm("dual spaces & weak topologies", true),
      rm("spectral theory", true),
      rm("compact operators", true),
      rm("C*-algebras", false)
    ],
    level: 5, masteryXP: 600, lastTouched: null
  },
  {
    id: "ergodic-theory", name: "Ergodic Theory", branch: "analysis",
    classTag: "math", maintenance: false, activeResearch: true,
    roadmap: [
      rm("measure-preserving systems", true),
      rm("Poincaré recurrence", true),
      rm("ergodicity", true),
      rm("mixing", true),
      rm("Birkhoff ergodic theorem", true),
      rm("transfer / Perron–Frobenius operator", true),
      rm("entropy", false),
      rm("symbolic dynamics", false)
    ],
    level: 6, masteryXP: 1500, lastTouched: null,
    synergyNote: "Overlaps the Gauss-map / ergodic subtopics of Number Theory — synergy glow between the two."
  },

  // ---------- Branch: Number Theory ----------
  {
    id: "number-theory", name: "Number Theory", branch: "number-theory",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("divisors, congruences & countability (Ch1)", true),
      rm("FTA & Bézout (Ch2)", true),
      rm("linear Diophantine equations & CRT (Ch3)", true),
      rm("number-theoretic functions & Möbius inversion (Ch4)", true),
      rm("modular arithmetic, primitive roots, Wilson (Ch5)", true),
      rm("continued fractions & the Gauss map (Ch6)", true),
      rm("fields, rings, ideals (Ch7)", true),
      rm("factorization in rings: ED/PID/UFD (Ch8)", true),
      rm("ergodic number theory: invariant measures & three maps (Ch9–10)", true),
      rm("Birkhoff ergodic theorem & Cauchy integral formula (Ch11–12)", true),
      rm("Prime Number Theorem (Ch13)", true),
      rm("Dirichlet L-functions & primes in arithmetic progressions (Ch14)", false),
      rm("unsolvability of the quintic (Ch15)", true)
    ],
    level: 12, masteryXP: 1000, lastTouched: null,
    synergyNote: "The Gauss-map / ergodic subtopics overlap Ergodic Theory — synergy glow between the two."
  },

  // ---------- Branch: Foundations / GRE (all maintenance:true) ----------
  {
    id: "single-var-calculus", name: "Single-variable Calculus", branch: "foundations",
    classTag: "math", maintenance: true,
    roadmap: [
      rm("limits & continuity", true),
      rm("derivatives & applications", true),
      rm("integration techniques", true),
      rm("sequences & series (convergence tests)", true),
      rm("Taylor & power series", true),
      rm("parametric & polar", true),
      rm("(add your own weak spots)", false)
    ],
    level: 6, masteryXP: 300, lastTouched: null
  },
  {
    id: "multivariable-calculus", name: "Multivariable Calculus", branch: "foundations",
    classTag: "math", maintenance: true,
    roadmap: [
      rm("partial derivatives", true),
      rm("multiple integrals", true),
      rm("vector fields, line & surface integrals", true),
      rm("Green / Stokes / divergence theorems", true)
    ],
    level: 4, masteryXP: 300, lastTouched: null
  },
  {
    id: "linear-algebra", name: "Linear Algebra", branch: "foundations",
    classTag: "math", maintenance: true,
    roadmap: [
      rm("vector spaces & linear maps", true),
      rm("determinants", true),
      rm("eigenvalues & eigenvectors", true),
      rm("diagonalization", true),
      rm("inner product spaces & spectral theorem", true),
      rm("Jordan canonical form", false)
    ],
    level: 5, masteryXP: 600, lastTouched: null
  },
  {
    id: "odes", name: "ODEs", branch: "foundations",
    classTag: "math", maintenance: true,
    roadmap: [
      rm("first-order ODEs", true),
      rm("linear ODEs & systems", true),
      rm("series solutions", true),
      rm("Laplace transforms", false),
      rm("stability & phase-plane analysis", false)
    ],
    level: 3, masteryXP: 100, lastTouched: null
  },
  {
    id: "elementary-probability", name: "Elementary Probability", branch: "foundations",
    classTag: "math", maintenance: true,
    roadmap: [
      rm("combinatorics", true),
      rm("probability axioms & random variables", true),
      rm("distributions, expectation, variance", true),
      rm("limit theorems (LLN, CLT)", true)
    ],
    level: 4, masteryXP: 600, lastTouched: null
  },

  // ---------- Branch: Diagrammatic Algebra (capstone / main quest) ----------
  {
    id: "braid-groups", name: "Braid Groups", branch: "diagrammatic",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("Artin braid group Bₙ & presentations", true),
      rm("braid closures & links", true),
      rm("Burau representation", true),
      rm("Temperley–Lieb representation of Bₙ", false),
      rm("Lawrence–Krammer representation", false),
      rm("faithfulness / linearity results", false)
    ],
    level: 3, masteryXP: 300, lastTouched: null
  },
  {
    id: "temperley-lieb", name: "Temperley–Lieb Categories", branch: "diagrammatic",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("the Temperley–Lieb algebra TLₙ", true),
      rm("diagram calculus", true),
      rm("Jones–Wenzl idempotents", true),
      rm("Markov trace", true),
      rm("the category TL (full TLJ construction)", true),
      rm("semisimplicity of generic TLJ", true),
      rm("relation to Hecke algebras", false)
    ],
    level: 6, masteryXP: 600, lastTouched: null,
    note: "Chen thesis, on Ch5"
  },
  {
    id: "skein-theory", name: "Skein Theory", branch: "diagrammatic",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("Kauffman bracket", true),
      rm("Jones polynomial", true),
      rm("skein relations", true),
      rm("skein modules of surfaces", false),
      rm("Kauffman-bracket skein algebra", false),
      rm("HOMFLY-PT", false)
    ],
    level: 3, masteryXP: 300, lastTouched: null
  },
  {
    id: "spiders-webs", name: "Spiders / Webs", branch: "diagrammatic",
    classTag: "math", maintenance: false,
    roadmap: [
      rm("SL₂ spider (= Temperley–Lieb)", true),
      rm("web categories & relations", false),
      rm("SL₃ spider (Kuperberg)", false),
      rm("confluence / diamond lemma for webs", false),
      rm("relation to representation theory", false),
      rm("higher-rank spiders", false)
    ],
    level: 1, masteryXP: 100, lastTouched: null,
    synergyNote: "★ Spiders ≡ TL — the same diagrammatic object two ways."
  },

  // ---------- Branch: Math Physics ----------
  {
    id: "classical-mechanics", name: "Classical Mechanics", branch: "math-physics",
    classTag: "physics", maintenance: false,
    roadmap: [
      rm("Newtonian mechanics", true),
      rm("Lagrangian mechanics & variational principles", true),
      rm("Hamiltonian mechanics", true),
      rm("symmetries & conservation laws", true),
      rm("canonical transformations", false),
      rm("Hamilton–Jacobi theory", false)
    ],
    level: 4, masteryXP: 600, lastTouched: null
  },
  {
    id: "special-relativity", name: "Special Relativity & Tensor Formalism", branch: "math-physics",
    classTag: "physics", maintenance: false,
    roadmap: [
      rm("Lorentz transformations", true),
      rm("Minkowski spacetime & 4-vectors", true),
      rm("tensor algebra & index calculus", true),
      rm("relativistic mechanics", true)
    ],
    level: 4, masteryXP: 600, lastTouched: null
  },
  {
    id: "classical-electrodynamics", name: "Classical Electrodynamics (relativistic)", branch: "math-physics",
    classTag: "physics", maintenance: false,
    roadmap: [
      rm("source-free / static", true),
      rm("source-free / dynamic (waves)", true),
      rm("source / static (multipole expansions)", true),
      rm("source / dynamic (radiation)", true),
      rm("covariant formulation", true),
      rm("gauge theory of E&M", false)
    ],
    level: 5, masteryXP: 600, lastTouched: null
  },
  {
    id: "classical-field-theory", name: "Classical Field Theory", branch: "math-physics",
    classTag: "physics", maintenance: false,
    roadmap: [
      rm("Lagrangian field theory", true),
      rm("Klein–Gordon equation", true),
      rm("Noether's theorem", true),
      rm("sine–Gordon, kinks & solitons", true),
      rm("spontaneous symmetry breaking", true),
      rm("Higgs mass mechanism", true),
      rm("classical gauge fields", false)
    ],
    level: 6, masteryXP: 600, lastTouched: null,
    note: "classical, not quantized"
  },
  {
    id: "quantum-stochastics", name: "Quantum Stochastics", branch: "math-physics",
    classTag: "both", maintenance: false,
    roadmap: [
      rm("quantum probability spaces", true),
      rm("operator-algebraic framework", true),
      rm("quantum stochastic calculus", true),
      rm("quantum Markov processes", false),
      rm("applications", false)
    ],
    level: 3, masteryXP: 600, lastTouched: null
  },
  {
    id: "quantum-computation", name: "Quantum Computation", branch: "math-physics",
    classTag: "both", maintenance: false,
    roadmap: [
      rm("qubits & quantum gates", true),
      rm("quantum circuits & entanglement", true),
      rm("anyons & braiding", true),
      rm("topological quantum computation", false),
      rm("toric / state-space visualization (current research — on the paper)", true)
    ],
    level: 4, masteryXP: 300, lastTouched: null
  }
];

// Branch display metadata (order + labels used by skills.js in Phase C)
const SEED_BRANCHES = [
  { id: "algebra", name: "Algebra" },
  { id: "topology", name: "Topology" },
  { id: "analysis", name: "Analysis" },
  { id: "number-theory", name: "Number Theory" },
  { id: "foundations", name: "Foundations / GRE", tag: "rusts" },
  { id: "diagrammatic", name: "Diagrammatic Algebra", tag: "capstone" },
  { id: "math-physics", name: "Math Physics" }
];

const SEED_SOURCES = [
  { id: "ets-gre", name: "ETS GRE Math Subject practice", tier: "gre" },
  { id: "stewart-calc", name: "Stewart, Calculus", tier: "gre" },
  { id: "hatcher", name: "Hatcher, Algebraic Topology", tier: "undergrad" },
  { id: "munkres", name: "Munkres, Topology", tier: "undergrad" },
  { id: "dummit-foote", name: "Dummit & Foote", tier: "undergrad" },
  { id: "torchinsky", name: "Torchinsky, Real Variables", tier: "graduate" },
  { id: "billingsley", name: "Billingsley, Probability & Measure", tier: "graduate" },
  { id: "chen-thesis", name: "Chen, The Temperley–Lieb Categories and Skein Modules (thesis)", tier: "research" },
  { id: "kuperberg", name: "Kuperberg, Spiders for rank 2 Lie algebras", tier: "research" }
];

const SEED_FOCI = [
  {
    id: "focus-chen", name: "Diagrammatic study — Chen thesis", cadence: "daily",
    skillId: "temperley-lieb", defaultUnitType: "notes",
    note: "currently on Chapter 5. Reading/notes only — do not generate exercises from Chen's thesis.",
    active: true, lastMet: null, streak: 0
  },
  {
    id: "focus-gre", name: "GRE prep", cadence: "weekly",
    skillId: "single-var-calculus", defaultUnitType: "exercise",
    note: "next session due Wednesday — tag whichever foundations skill the session covers",
    active: true, lastMet: null, streak: 0
  },
  {
    id: "focus-ergodic", name: "Ergodic paper — final tightening", cadence: "semi-weekly",
    skillId: "ergodic-theory", defaultUnitType: "exposition",
    note: "finishing/submitting; archivable when done",
    active: true, lastMet: null, streak: 0
  }
];

const SEED_BOUNTIES = [
  { id: "bounty-urysohn", title: "Prove Urysohn's Lemma", skillId: "point-set-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-compactness", title: "Work compactness ⇔ characterizations on metric spaces", skillId: "point-set-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-pi1-circle", title: "Compute π₁ of the circle from covering-space theory", skillId: "algebraic-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-cw-torus", title: "Build a CW structure on the torus T²", skillId: "algebraic-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-h-torus", title: "Compute H*(T²) from that CW structure", skillId: "algebraic-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-h-rp2", title: "Compute H*(ℝP²) and watch the torsion appear", skillId: "algebraic-topology", suggestedUnitType: "exercise", tier: "undergrad", done: false },
  { id: "bounty-ext-functor", title: "Write out the Ext functor as a derived functor on a concrete example", skillId: "homological-algebra", suggestedUnitType: "exercise", tier: "graduate", done: false },
  { id: "bounty-monoidal-coherence", title: "Verify a small monoidal category's coherence (pentagon/triangle)", skillId: "category-theory", suggestedUnitType: "exercise", tier: "graduate", done: false },
  { id: "bounty-kauffman-trefoil", title: "Compute the Kauffman bracket of the trefoil by hand", skillId: "skein-theory", suggestedUnitType: "exercise", tier: "research", done: false },
  { id: "bounty-jw-idempotent", title: "Verify a Jones–Wenzl idempotent for small n", skillId: "temperley-lieb", suggestedUnitType: "exercise", tier: "research", done: false },
  { id: "bounty-mobius-tl", title: "Experiment: TL diagrams on the Möbius band — explore what \"nobody knows\"", skillId: "spiders-webs", suggestedUnitType: "experiment", tier: "research", done: false },
  { id: "bounty-klein-tl", title: "Experiment: TL / Klein bottle companion exploration", skillId: "spiders-webs", suggestedUnitType: "experiment", tier: "research", done: false },
  { id: "bounty-series-drill", title: "Drill a set of tricky series-convergence / weird-sum problems", skillId: "single-var-calculus", suggestedUnitType: "exercise", tier: "gre", done: false },
  { id: "bounty-taylor-rederive", title: "Re-derive common Taylor series from scratch", skillId: "single-var-calculus", suggestedUnitType: "exercise", tier: "gre", done: false },
  { id: "bounty-eigen-speed", title: "Eigen-everything speed set", skillId: "linear-algebra", suggestedUnitType: "exercise", tier: "gre", done: false }
];

const SEED_CAMPAIGN = {
  spiderTrack: [
    { step: "SL₂ spider, rigorously", done: true },
    { step: "Establish its identity with Temperley–Lieb", done: true },
    { step: "SL₃ webs (Kuperberg)", done: false },
    { step: "Higher spiders", done: false }
  ],
  surfaceTrack: [
    { step: "TL diagrams on the Möbius band", done: false },
    { step: "TL diagrams on the Klein bottle", done: false },
    { step: "Characterize what breaks/changes on nonorientable surfaces", done: false }
  ],
  bosses: [
    { step: "The GRE exam itself", done: false },
    { step: "Give a talk", done: false },
    { step: "Reproduce a paper's main theorem", done: false }
  ]
};

const SEED_TITLES_LADDER = [
  "Undergraduate Student",
  "Senior Undergraduate",
  "Graduate Student",
  "Doctoral Candidate",
  "Postdoctoral Researcher",
  "Lecturer",
  "Professor"
];
