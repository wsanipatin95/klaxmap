import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

const MyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdf4f9',
      100: '#fbe8f3',
      200: '#f8d1e9',
      300: '#f3aad6',
      400: '#eb79ba',
      500: '#e0509f',
      600: '#cd327f',
      700: '#b02365',
      800: '#921f54',
      900: '#7B0061', // Color principal
      950: '#4d0038'
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.900}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.950}'
        },
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        }
      },
      dark: {
        primary: {
          color: '{primary.400}',
          contrastColor: '{primary.950}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}'
        },
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        }
      }
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.500}',
      offset: '2px'
    }
  },
  components: {
    button: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.375rem',
        borderRadius: '0.375rem'
      }
    },
    inputtext: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.375rem',
        borderRadius: '0.375rem'
      }
    },
    select: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.375rem',
        borderRadius: '0.375rem'
      }
    },
    dropdown: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.375rem',
        fontSize: '0.875rem',
        borderRadius: '0.375rem'
      },
      sm: {
        fontSize: '0.75rem',
        paddingX: '0.5rem',
        paddingY: '0.25rem'
      },
      lg: {
        fontSize: '1rem',
        paddingX: '1rem',
        paddingY: '0.5rem'
      }
    },
    multiselect: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        borderRadius: '0.375rem'
      }
    },
    textarea: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.5rem',
        borderRadius: '0.375rem'
      }
    },
    checkbox: {
      root: {
        width: '1.125rem',
        height: '1.125rem',
        borderRadius: '0.25rem'
      }
    },
    radiobutton: {
      root: {
        width: '1.125rem',
        height: '1.125rem'
      }
    }
  }
});

export default MyPreset;