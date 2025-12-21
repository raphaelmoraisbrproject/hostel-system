// Shared react-select styles matching the design system
export const selectStyles = {
    control: (base, state) => ({
        ...base,
        backgroundColor: 'rgb(249, 250, 251)',
        borderColor: state.isFocused ? 'rgb(16, 185, 129)' : 'rgb(229, 231, 235)',
        borderRadius: '0.5rem',
        padding: '0',
        minHeight: '38px',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none',
        '&:hover': { borderColor: 'rgb(16, 185, 129)' }
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        zIndex: 50
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? 'rgb(16, 185, 129)' : state.isFocused ? 'rgb(236, 253, 245)' : 'white',
        color: state.isSelected ? 'white' : 'rgb(17, 24, 39)',
        fontSize: '0.875rem',
        padding: '8px 12px',
        cursor: 'pointer'
    }),
    groupHeading: (base) => ({
        ...base,
        fontSize: '0.65rem',
        fontWeight: 700,
        color: 'rgb(156, 163, 175)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '8px 12px 4px'
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: '0.875rem',
        color: 'rgb(17, 24, 39)'
    }),
    placeholder: (base) => ({
        ...base,
        fontSize: '0.875rem',
        color: 'rgb(209, 213, 219)'
    }),
    input: (base) => ({
        ...base,
        fontSize: '0.875rem'
    })
};
