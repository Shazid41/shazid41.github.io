---
name: Quantum Precision
colors:
  surface: '#0c1324'
  surface-dim: '#0c1324'
  surface-bright: '#33394c'
  surface-container-lowest: '#070d1f'
  surface-container-low: '#151b2d'
  surface-container: '#191f31'
  surface-container-high: '#23293c'
  surface-container-highest: '#2e3447'
  on-surface: '#dce1fb'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dce1fb'
  inverse-on-surface: '#2a3043'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#fff2fd'
  on-tertiary: '#520071'
  tertiary-container: '#f4ccff'
  on-tertiary-container: '#9900d0'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#f8d8ff'
  tertiary-fixed-dim: '#ecb2ff'
  on-tertiary-fixed: '#320047'
  on-tertiary-fixed-variant: '#74009f'
  background: '#0c1324'
  on-background: '#dce1fb'
  surface-variant: '#2e3447'
typography:
  h1:
    fontFamily: Sora
    fontSize: 4.5rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Sora
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Sora
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  section-padding: 120px
---

## Brand & Style
This design system is engineered for a high-end portfolio that merges technical mastery with futuristic aesthetics. The brand personality is **visionary, technical, and premium**, targeting global tech recruiters and high-growth startup founders who value both code quality and AI innovation. 

The visual direction utilizes a **Futuristic Glassmorphism** style. It relies on deep architectural layers, combining the density of dark, navy-rich backgrounds with the ethereal lightness of frosted glass panels. The emotional response should be one of "discovery and reliability"—the feeling of interacting with a highly advanced, stable AI dashboard. Motion is integral to this system; transitions should feel frictionless and organic, mimicking the fluid nature of data flow.

## Colors
The palette is rooted in a **Deep Dark** foundation using a rich midnight navy (`#020617`) to ensure maximum depth and contrast for neon elements. 

- **Primary & Secondary:** An electric cyan and royal purple serve as the main interaction points, often used in tandem as linear gradients (45-degree angles).
- **Gradients:** Use "Soft Neon" gradients for key calls to action and borders, blending Primary Cyan to Secondary Purple. 
- **Glass Surfaces:** Backgrounds for content cards utilize a semi-transparent slate with a heavy background blur (20px+) to maintain legibility while showcasing the vibrant gradients underneath.
- **Accents:** Tertiary magenta/pink is reserved for high-priority alerts or AI-specific feature tags.

## Typography
The typographic hierarchy is designed to be highly legible yet technically expressive. 

**Sora** is utilized for headlines to provide a geometric, futuristic feel with wide apertures. For the primary reading experience, **Inter** offers a neutral, highly readable canvas that balances the louder display elements. **Space Grotesk** is used sparingly for labels, metadata, and "tech specs," providing a subtle nod to terminal interfaces and technical documentation. Large headlines should often use a subtle vertical gradient (White to 80% Grey) to add metallic depth.

## Layout & Spacing
This design system employs a **Fixed Grid** model for large screens, centered within the viewport to maintain a premium "gallery" feel. 

- **Grid:** A 12-column system with generous 24px gutters.
- **Overlay:** A subtle, low-opacity (2-3%) square grid pattern should be overlaid across the background to reinforce the "development" theme.
- **Rhythm:** Generous vertical whitespace (120px+) between sections is mandatory to allow the glass elements and background "blobs" room to breathe.
- **Alignment:** Content is generally left-aligned for technical precision, but hero sections may use centered typography for impact.

## Elevation & Depth
Depth is achieved through **Glassmorphism and Glows** rather than traditional drop shadows.

1.  **Backdrop Blur:** All cards and navigation bars must use `backdrop-filter: blur(24px)` combined with a 1px border.
2.  **Inner Glow:** Cards feature a 1px semi-transparent white top border to simulate light hitting the edge of a glass pane.
3.  **Ambient Orbs:** Large, blurred radial gradients (200px-500px) in Primary and Secondary colors sit *behind* the glass layers, creating a sense of deep space.
4.  **Z-Index Logic:** Interactive elements "lift" by increasing the border opacity and the intensity of the background blur.

## Shapes
The shape language is **Rounded**, avoiding sharp "aggressive" corners to maintain a sophisticated startup feel. Standard elements use a 0.5rem radius, while large glass containers and cards utilize 1rem (`rounded-lg`) to feel more substantial. Interactive elements like buttons may occasionally use pill-shaped containers if they contain only icons or short labels, providing a distinct contrast to the more structured grid of content cards.

## Components

- **Glowing Buttons:** Primary buttons are filled with a Cyan-to-Purple gradient. They feature a `box-shadow` using the same gradient colors but with a high blur (20px) and 50% opacity to create a "neon" glow. On hover, the glow expands.
- **Glass Cards:** The signature component. These must have a `border: 1px solid rgba(255, 255, 255, 0.1)` and a slightly darker background than the main site to create contrast.
- **Gradient Borders:** Secondary cards use a transparent background but a 2px border containing a multi-stop linear gradient.
- **Input Fields:** Minimalist design with only a bottom border that "lights up" with a gradient when focused. Labels use the `label-caps` style.
- **AI Specialist Chips:** Small, pill-shaped tags used for skills. These should have a subtle pulse animation and a very light tint of the primary cyan color.
- **Project Lists:** Vertical lists where the hover state reveals a preview image inside a glass tooltip that follows the cursor.