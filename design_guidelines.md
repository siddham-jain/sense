{
  "brand_attributes": ["calm", "focused", "premium", "developer-first", "curiosity-driven", "minimalist-dark with warm glow"],
  "visual_personality": {
    "one_liner": "Warm light in a dark room. Linear/Raycast calm, with amber embers for focus.",
    "style_fusion": [
      "Layout hierarchy from Linear",
      "Command-palette minimalism from Raycast",
      "Warm cinema lighting (amber/peach) on near-black",
      "R3F knowledge cosmos with soft bloom"
    ]
  },
  "color_tokens_tailwind_hsl": {
    "note": "Use these as CSS variables in :root and .dark. Primary is warm amber; do not use saturated purple/pink gradients.",
    "light": {
      "--background": "210 20% 98%",
      "--foreground": "222 16% 12%",
      "--card": "0 0% 100%",
      "--card-foreground": "222 16% 12%",
      "--muted": "220 14% 92%",
      "--muted-foreground": "220 9% 40%",
      "--border": "220 13% 90%",
      "--input": "220 13% 90%",
      "--ring": "38 92% 58%",
      "--primary": "38 92% 58%",
      "--primary-foreground": "230 15% 10%",
      "--secondary": "220 14% 94%",
      "--secondary-foreground": "222 16% 18%",
      "--accent": "18 86% 64%",
      "--accent-foreground": "230 15% 10%",
      "--destructive": "6 84% 58%",
      "--destructive-foreground": "0 0% 100%",
      "--chart-1": "38 92% 58%",
      "--chart-2": "188 58% 44%",
      "--chart-3": "158 42% 45%",
      "--chart-4": "210 34% 36%",
      "--chart-5": "24 94% 62%",
      "--radius": "0.6rem"
    },
    "dark": {
      "--background": "230 15% 7%",
      "--foreground": "220 14% 92%",
      "--card": "230 12% 9%",
      "--card-foreground": "220 14% 92%",
      "--muted": "228 10% 16%",
      "--muted-foreground": "220 9% 64%",
      "--border": "225 10% 20%",
      "--input": "225 10% 20%",
      "--ring": "38 92% 58%",
      "--primary": "38 92% 58%",
      "--primary-foreground": "230 15% 7%",
      "--secondary": "220 10% 16%",
      "--secondary-foreground": "220 12% 90%",
      "--accent": "18 86% 64%",
      "--accent-foreground": "230 15% 7%",
      "--destructive": "6 72% 44%",
      "--destructive-foreground": "0 0% 100%",
      "--chart-1": "38 92% 58%",
      "--chart-2": "188 58% 44%",
      "--chart-3": "158 42% 45%",
      "--chart-4": "210 34% 36%",
      "--chart-5": "24 94% 62%",
      "--radius": "0.6rem"
    },
    "gradients": {
      "warm_glow_radial": "radial-gradient(60% 60% at 20% 10%, hsl(38 92% 20%) 0%, hsla(38 92% 20%/0.0) 60%), radial-gradient(40% 40% at 80% 30%, hsl(18 86% 16%) 0%, hsla(18 86% 16%/0) 70%)",
      "warm_line": "linear-gradient(120deg, hsl(38 92% 58%) 0%, hsl(24 92% 62%) 50%, hsl(18 86% 64%) 100%)",
      "usage": [
        "Only section/hero backgrounds and large decorative accents",
        "Never on dense text blocks or small UI elements",
        "Keep gradient areas <= 20% of viewport"
      ]
    },
    "textures": {
      "noise_css": ".noise-overlay{pointer-events:none;position:absolute;inset:0;background-image:url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"100%\" height=\"100%\" filter=\"url(%23n)\" opacity=\"0.03\"/></svg>');mix-blend-mode:soft-light;}",
      "apply": "Place inside hero sections only; not over content cards"
    }
  },
  "typography": {
    "fonts": {
      "heading": "Space Grotesk",
      "body": "Fira Sans",
      "mono_optional": "IBM Plex Mono"
    },
    "import_css": "<link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Fira+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">",
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl tracking-tight",
      "h2": "text-base md:text-lg font-medium text-muted-foreground",
      "body": "text-sm md:text-base leading-relaxed",
      "small": "text-xs text-muted-foreground"
    },
    "rules": [
      "Headings letter-spacing -0.01em; avoid all caps",
      "Use 2–3x whitespace around major sections"
    ]
  },
  "layout_grid": {
    "mobile_first": true,
    "containers": {
      "default": "mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-2xl",
      "content_widths": ["prose: 70ch max for text", "feed: 720px center column on desktop", "graph: full-bleed canvas beneath header"]
    },
    "patterns": [
      "Bento split: left command sidebar, center feed, right insights (≥1280px)",
      "Single-column on mobile with sticky bottom controls"
    ]
  },
  "components": {
    "onboarding_topics": {
      "description": "Users select 3–5 topics from ~10 domains.",
      "shadcn": ["./components/ui/card", "./components/ui/checkbox", "./components/ui/button", "./components/ui/progress"],
      "layout": "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4",
      "tile": "group relative overflow-hidden rounded-lg border border-border bg-card/60 hover:bg-card focus-within:ring-2 focus-within:ring-ring transition-colors",
      "tile_content": "flex items-center gap-3 p-3",
      "micro": [
        "Hover: subtle border glow via ring-[--ring]",
        "Select: tile elevates with shadow-md + ring-1",
        "Constraint: Continue disabled until 3–5 selected"
      ],
      "testids": [
        "data-testid=\"onboarding-topic-checkbox-{slug}\"",
        "data-testid=\"onboarding-continue-button\"",
        "data-testid=\"onboarding-selected-count\""
      ],
      "example_js": "function Onboarding(){const [sel,setSel]=React.useState([]);const topics=['AI','Technology','Startups','Business','History','Psychology','Finance','Philosophy','Health','Productivity'];const toggle=t=>setSel(p=>p.includes(t)?p.filter(x=>x!==t):p.length<5?[...p,t]:p);const can=sel.length>=3&&sel.length<=5;return (<div className=\"\"><div className=\"mb-6 flex items-center justify-between\"><h1 className=\"text-3xl font-semibold\">Choose your interests</h1><span className=\"text-sm text-muted-foreground\" data-testid=\"onboarding-selected-count\">{sel.length}/5</span></div><div className=\"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3\">{topics.map(t=> (<button key={t} aria-pressed={sel.includes(t)} data-testid={\`onboarding-topic-checkbox-${t.toLowerCase()}\`} onClick={()=>toggle(t)} className=\"group relative rounded-lg border border-border bg-card/60 hover:bg-card focus:ring-2 focus:ring-ring px-3 py-2 text-left\"><div className=\"flex items-center gap-3\"><span className=\"size-2 rounded-full bg-[hsl(38_92%_58%)] group-aria-pressed:bg-[hsl(188_58%_44%)]\"/><span>{t}</span></div></button>))}</div><div className=\"mt-6 flex gap-3\"><button data-testid=\"onboarding-continue-button\" disabled={!can} className=\"inline-flex items-center justify-center rounded-md bg-[hsl(38_92%_58%)] text-[hsl(230_15%_7%)] px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed\">Continue</button><button data-testid=\"onboarding-skip-button\" className=\"inline-flex items-center justify-center rounded-md border border-border px-4 py-2\">Skip</button></div></div>)}"
    },
    "video_feed": {
      "description": "Reels-style vertical short-form educational videos with like/dislike/save/share.",
      "shadcn": ["./components/ui/aspect-ratio", "./components/ui/card", "./components/ui/button", "./components/ui/progress", "./components/ui/tooltip"],
      "libs": ["framer-motion", "react-player", "lucide-react"],
      "layout": "max-w-[720px] mx-auto space-y-8",
      "card": "relative rounded-xl overflow-hidden bg-card border border-border",
      "video_wrapper": "relative bg-black",
      "actions_overlay": "absolute right-3 bottom-3 flex flex-col items-center gap-3",
      "info_overlay": "pointer-events-none absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-black/0 to-transparent text-white",
      "progress": "absolute top-0 inset-x-0",
      "micro": [
        "Double-tap to like (heart burst) using framer-motion",
        "Hold to pause, release to resume",
        "Auto-play muted on reveal; stop when off-screen",
        "Hover/focus ring on action buttons; tooltips on desktop"
      ],
      "testids": [
        "data-testid=\"video-card\"",
        "data-testid=\"video-like-button\"",
        "data-testid=\"video-dislike-button\"",
        "data-testid=\"video-save-button\"",
        "data-testid=\"video-share-button\"",
        "data-testid=\"video-progress\""
      ],
      "example_js": "import React from 'react';import ReactPlayer from 'react-player';import { Heart, ThumbsDown, Bookmark, Share2 } from 'lucide-react';import { motion, useAnimation } from 'framer-motion';export function ReelCard({src,title}){const [liked,setLiked]=React.useState(false);const controls=useAnimation();const onDouble=()=>{setLiked(true);controls.start({scale:[0.6,1.2,1],opacity:[0,1,0],transition:{duration:0.6}})};return (<div className=\"relative rounded-xl overflow-hidden border border-border bg-card\" data-testid=\"video-card\" onDoubleClick={onDouble}><div className=\"aspect-[9/16] bg-black\"><ReactPlayer url={src} width=\"100%\" height=\"100%\" playing muted loop playsinline/></div><motion.div className=\"absolute inset-0 grid place-items-center\" animate={controls}><Heart className=\"size-24 text-[hsl(38_92%_58%)]\"/></motion.div><div className=\"absolute right-3 bottom-3 flex flex-col items-center gap-3\"><button className=\"rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur-sm\" data-testid=\"video-like-button\" aria-pressed={liked}><Heart/></button><button className=\"rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur-sm\" data-testid=\"video-dislike-button\"><ThumbsDown/></button><button className=\"rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur-sm\" data-testid=\"video-save-button\"><Bookmark/></button><button className=\"rounded-full bg-white/10 hover:bg-white/20 p-3 backdrop-blur-sm\" data-testid=\"video-share-button\"><Share2/></button></div><div className=\"pointer-events-none absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-transparent to-transparent text-white\"><h3 className=\"font-semibold\">{title}</h3></div><div className=\"absolute top-0 inset-x-0\" aria-hidden data-testid=\"video-progress\"><div className=\"h-0.5 bg-white/20\"><div className=\"h-full w-1/3 bg-[hsl(38_92%_58%)]\"/></div></div></div>)}"
    },
    "knowledge_graph_3d": {
      "description": "Interactive 3D cognitive landscape using React Three Fiber + r3f-forcegraph.",
      "libs": ["three", "@react-three/fiber", "@react-three/drei", "r3f-forcegraph", "@react-three/postprocessing"],
      "style": {
        "background": "#0b0d12",
        "node": "emissive warm for frequent topics (amber), cool slate for lesser",
        "link": "thin teal/cyan with opacity based on similarity",
        "effects": "subtle bloom + vignette for glow; no harsh neon"
      },
      "micro": [
        "Hover: highlight node + connected edges",
        "Click: focus camera, open mini card",
        "Scroll: zoom; drag: orbit/pan",
        "Legend and mini filters overlay (top-right)"
      ],
      "testids": [
        "data-testid=\"graph-canvas\"",
        "data-testid=\"graph-filter-toggle\"",
        "data-testid=\"graph-legend\""
      ],
      "example_js": "import React from 'react';import { Canvas } from '@react-three/fiber';import { ForceGraph3D } from 'r3f-forcegraph';import * as THREE from 'three';import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';const data={nodes:[{id:'AI',val:16,freq:0.9},{id:'History',val:8,freq:0.3}],links:[{source:'AI',target:'History',sim:0.2}]};export function KnowledgeGraph(){return (<div className=\"relative h-[70vh] w-full rounded-xl border border-border bg-[rgb(11,13,18)]\"><Canvas camera={{position:[0,0,160], fov:60}} onCreated={({gl})=>{gl.setClearColor('#0b0d12')}} data-testid=\"graph-canvas\"><ambientLight intensity={0.45}/><directionalLight position={[30,60,50]} intensity={0.6} color={new THREE.Color('hsl(38,92%,58%)')}/><ForceGraph3D graphData={data} nodeRelSize={4} linkOpacity={0.35} linkColor={e=>e.sim>0.5?'#62d0c6':'#3aa0a0'} linkWidth={e=>1+e.sim*2} nodeThreeObject={n=>{const g=new THREE.SphereGeometry(2+Math.max(1,n.val*0.2));const m=new THREE.MeshStandardMaterial({color:n.freq>0.6?new THREE.Color('hsl(38,92%,58%)'):new THREE.Color('#8b95a7'), emissive:n.freq>0.6?new THREE.Color('hsl(38,92%,32%)'):new THREE.Color('#1e222b'), roughness:0.6, metalness:0.2});return new THREE.Mesh(g,m);}} onNodeClick={(n,ev,fg)=>{fg.cameraPosition({x:n.x*1.6,y:n.y*1.6,z:n.z*1.6}, n, 1000)}}/><EffectComposer><Bloom intensity={0.3} luminanceThreshold={0.4}/><Vignette eskil={false} offset={0.15} darkness={0.8}/></EffectComposer></Canvas><div className=\"absolute right-3 top-3 rounded-md bg-black/50 backdrop-blur px-3 py-2 text-xs text-white\" data-testid=\"graph-legend\">Node size ~ frequency • Edge weight ~ similarity</div></div>)}"
    },
    "chrome_extension_panel": {
      "description": "Minimal panel to show tracking status and quick actions.",
      "size": "min-w-[320px] min-h-[420px]",
      "shadcn": ["./components/ui/switch", "./components/ui/card", "./components/ui/button", "./components/ui/tooltip"],
      "example_js": "export default function ExtensionPanel(){const [on,setOn]=React.useState(true);return (<div className=\"p-4 bg-[hsl(230_15%_7%)] text-[hsl(220_14%_92%)]\"><div className=\"rounded-xl border border-border bg-card p-4\"><div className=\"flex items-center justify-between\"><h2 className=\"text-base font-medium\">Sense Collector</h2><label className=\"inline-flex items-center gap-2\"><span className=\"text-xs text-muted-foreground\">Status</span><input type=\"checkbox\" checked={on} onChange={e=>setOn(e.target.checked)} data-testid=\"collector-toggle\" className=\"size-5 accent-[hsl(38_92%_58%)]\"/></label></div><div className=\"mt-4 text-sm text-muted-foreground\">Capture browsing topics to fuel your Sense graph.</div><div className=\"mt-4 flex gap-2\"><button className=\"rounded-md bg-[hsl(38_92%_58%)] text-[hsl(230_15%_7%)] px-3 py-2 text-sm\" data-testid=\"extension-manual-sync-button\">Sync now</button><button className=\"rounded-md border border-border px-3 py-2 text-sm\" data-testid=\"extension-view-graph-button\">Open graph</button></div></div></div>)}"
    }
  },
  "buttons": {
    "brand": "Professional / Corporate with a hint of luxury glow",
    "tokens": {
      "--btn-radius": "0.6rem",
      "--btn-shadow": "0 8px 24px -8px hsla(38,92%,58%,0.25)",
      "--btn-focus": "0 0 0 3px hsla(38,92%,58%,0.35)",
      "--btn-motion": "150ms ease-out"
    },
    "variants": {
      "primary": "rounded-[var(--btn-radius)] bg-[hsl(38_92%_58%)] text-[hsl(230_15%_7%)] hover:bg-[hsl(38_92%_54%)] shadow-[var(--btn-shadow)] focus-visible:outline-none focus-visible:ring-0 focus-visible:[box-shadow:var(--btn-focus)]",
      "secondary": "rounded-[var(--btn-radius)] bg-secondary text-secondary-foreground hover:bg-secondary/90 border border-border",
      "ghost": "rounded-[var(--btn-radius)] bg-transparent hover:bg-white/5 text-foreground"
    },
    "sizes": {"sm": "h-9 px-3 text-sm","md": "h-10 px-4","lg": "h-12 px-5 text-base"},
    "accessibility": "All buttons must expose focus-visible with >=3:1 focus ring contrast and data-testid attributes"
  },
  "motion_micro_interactions": {
    "libraries": ["framer-motion"],
    "principles": [
      "0.15–0.25s standard transitions, no transition: all",
      "Easing: ease-out for entrances, ease-in for exits",
      "Subtle parallax on hero background gradients (<8px)"
    ],
    "examples": {
      "card_hover": "hover:translate-y-[-2px] hover:shadow-lg transition-transform duration-150",
      "list_reveal": "use staggered children with 60ms delay"
    }
  },
  "accessibility": {
    "contrast": "WCAG AA minimum; body text ~ 7:1 on dark",
    "reduced_motion": "Respect prefers-reduced-motion: disable motion-heavy effects",
    "hit_targets": ">=44x44px for all action icons",
    "keyboard": "Every interactive element is tabbable with visible focus"
  },
  "testids_policy": {
    "rule": "All interactive and key informational elements MUST include data-testid in kebab-case summarising role.",
    "examples": [
      "login-form-submit-button",
      "video-like-button",
      "graph-canvas",
      "onboarding-topic-checkbox-ai"
    ]
  },
  "image_urls": [
    {"url": "https://images.unsplash.com/photo-1680446459280-9f77db805b8d?crop=entropy&cs=srgb&fm=jpg&q=85", "category": "hero", "description": "Warm window light in a dark room (use as subtle hero background, masked)"},
    {"url": "https://images.unsplash.com/photo-1745614523852-d53ec9d4212d?crop=entropy&cs=srgb&fm=jpg&q=85", "category": "section-divider", "description": "Amber glow through doorway for section breaks"},
    {"url": "https://images.pexels.com/photos/3864610/pexels-photo-3864610.jpeg", "category": "empty-state", "description": "Soft horizon glow, low noise, for empty graph/feed"}
  ],
  "component_path": {
    "shadcn": {
      "accordion": "./components/ui/accordion",
      "alert": "./components/ui/alert",
      "alert-dialog": "./components/ui/alert-dialog",
      "aspect-ratio": "./components/ui/aspect-ratio",
      "avatar": "./components/ui/avatar",
      "badge": "./components/ui/badge",
      "button": "./components/ui/button",
      "calendar": "./components/ui/calendar",
      "card": "./components/ui/card",
      "carousel": "./components/ui/carousel",
      "checkbox": "./components/ui/checkbox",
      "dialog": "./components/ui/dialog",
      "drawer": "./components/ui/drawer",
      "hover-card": "./components/ui/hover-card",
      "input": "./components/ui/input",
      "label": "./components/ui/label",
      "menubar": "./components/ui/menubar",
      "navigation-menu": "./components/ui/navigation-menu",
      "pagination": "./components/ui/pagination",
      "popover": "./components/ui/popover",
      "progress": "./components/ui/progress",
      "radio-group": "./components/ui/radio-group",
      "scroll-area": "./components/ui/scroll-area",
      "select": "./components/ui/select",
      "separator": "./components/ui/separator",
      "sheet": "./components/ui/sheet",
      "skeleton": "./components/ui/skeleton",
      "slider": "./components/ui/slider",
      "sonner": "./components/ui/sonner",
      "switch": "./components/ui/switch",
      "table": "./components/ui/table",
      "tabs": "./components/ui/tabs",
      "textarea": "./components/ui/textarea",
      "toast": "./components/ui/toast",
      "toaster": "./components/ui/toaster",
      "toggle": "./components/ui/toggle",
      "tooltip": "./components/ui/tooltip"
    }
  },
  "instructions_to_main_agent": {
    "1_tokens_setup": {
      "action": "Replace :root and .dark color tokens in /app/frontend/src/index.css with this palette. Ensure dark is default for app shell.",
      "snippet_css": ":root{--background:210 20% 98%;--foreground:222 16% 12%;--card:0 0% 100%;--card-foreground:222 16% 12%;--muted:220 14% 92%;--muted-foreground:220 9% 40%;--border:220 13% 90%;--input:220 13% 90%;--ring:38 92% 58%;--primary:38 92% 58%;--primary-foreground:230 15% 10%;--secondary:220 14% 94%;--secondary-foreground:222 16% 18%;--accent:18 86% 64%;--accent-foreground:230 15% 10%;--destructive:6 84% 58%;--destructive-foreground:0 0% 100%;--chart-1:38 92% 58%;--chart-2:188 58% 44%;--chart-3:158 42% 45%;--chart-4:210 34% 36%;--chart-5:24 94% 62%;--radius:0.6rem}.dark{--background:230 15% 7%;--foreground:220 14% 92%;--card:230 12% 9%;--card-foreground:220 14% 92%;--muted:228 10% 16%;--muted-foreground:220 9% 64%;--border:225 10% 20%;--input:225 10% 20%;--ring:38 92% 58%;--primary:38 92% 58%;--primary-foreground:230 15% 7%;--secondary:220 10% 16%;--secondary-foreground:220 12% 90%;--accent:18 86% 64%;--accent-foreground:230 15% 7%;--destructive:6 72% 44%;--destructive-foreground:0 0% 100%;--chart-1:38 92% 58%;--chart-2:188 58% 44%;--chart-3:158 42% 45%;--chart-4:210 34% 36%;--chart-5:24 94% 62%;--radius:0.6rem}"
    },
    "2_dependencies": {
      "install": "npm i framer-motion react-player three @react-three/fiber @react-three/drei r3f-forcegraph @react-three/postprocessing lucide-react @use-gesture/react",
      "why": ["Framer Motion for micro-interactions","R3F + forcegraph for 3D","Postprocessing for bloom","Lucide icons for actions","React Player for videos","Use-gesture for touch gestures if needed"]
    },
    "3_layout_scaffolds": {
      "app_shell": "Header (left: logo mark, center: search, right: avatar) • Main (center feed) • Optional left rail (nav) and right rail (insights) on ≥1280px.",
      "classes": {
        "shell": "min-h-screen bg-[hsl(230_15%_7%)] text-foreground",
        "hero": "relative overflow-hidden",
        "hero_bg": "absolute inset-0 opacity-80 [mask-image:radial-gradient(50%_40%_at_10%_0%,#000_40%,transparent_85%)]"
      }
    },
    "4_video_feed_build": "Compose ReelCard for each item, wrapped in a ScrollArea if needed. Ensure each action has data-testid. Use Progress or custom div for progress.",
    "5_graph_build": "Mount KnowledgeGraph below the fold. Provide empty states using Skeleton and the empty-state image. Ensure canvas container has data-testid=graph-canvas.",
    "6_onboarding": "Use tile buttons with Checkbox semantics; enforce 3–5 selection logic; Continue disabled state.",
    "7_toasts": "Import { Toaster } from ./components/ui/sonner and add at app root. Trigger save/like actions with success/error toasts.",
    "8_gradients_rule": "Apply gradients only to hero/section backgrounds. Never on cards or dense text. Keep under 20% of viewport.",
    "9_testing": "All interactive/key informational elements must include data-testid as specified."
  },
  "knowledge_graph_visual_spec": {
    "node_size": "base radius 2 + val*0.2",
    "node_color": "freq>=0.6 => amber emissive; else slate/blue-gray",
    "edge_thickness": "1 + similarity*2",
    "edge_color": "cyan/teal with 0.35 opacity",
    "lights": "ambient 0.45 + directional warm 0.6",
    "camera": "focus on click, smooth 1000ms",
    "legend": "top-right overlay with mini explanation"
  },
  "video_feed_spec": {
    "autoplay": "on reveal, muted; pause when out of view",
    "actions": ["like", "dislike", "save", "share"],
    "gesture": ["double-tap like", "press-to-pause"],
    "safe_area": "bottom overlays padded; avoid covering captions",
    "icons": "lucide-react 20–24px, hit area 44px"
  },
  "chrome_extension_spec": {
    "tone": "ultra-minimal",
    "layout": "title + toggle + 2 actions",
    "persistence": "sync state in chrome.storage; optimistic toast on sync"
  },
  "empty_states": {
    "graph": "Card with image_urls[2] and Copy: 'Your graph wakes up as you browse.'",
    "feed": "Skeleton placeholder cards with subtle shimmer"
  },
  "web_inspirations": {
    "dark_mode_best_practices": "https://blog.logrocket.com/ux-design/dark-mode-ui-design-best-practices-and-examples/",
    "r3f_forcegraph": "https://github.com/vasturiano/r3f-forcegraph",
    "raycast_linear_vibe": ["https://www.darkmodedesign.com", "https://muz.li/inspiration/dark-mode/"]
  }
}

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."}],