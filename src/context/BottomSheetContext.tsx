import React, { createContext, useState, ReactNode, useEffect } from 'react';

interface BottomSheetContextProps {
    sheetIsOpen: boolean;
    setSheetIsOpen: (value: boolean) => void;
}

export const BottomSheetContext = createContext<BottomSheetContextProps>({
    sheetIsOpen: false,
    setSheetIsOpen: () => { },
});

export const BottomSheetProvider = ({ children }: { children: ReactNode }) => {
    const [sheetIsOpen, setSheetIsOpen] = useState(false);

    return (
        <BottomSheetContext.Provider value={{ sheetIsOpen, setSheetIsOpen }}>
            {children}
        </BottomSheetContext.Provider>
    );
};
