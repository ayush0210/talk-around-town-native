import React, { useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomSheetContext } from '../context/BottomSheetContext';

const CustomTabBar: React.FC<BottomTabBarProps> = ({
    state,
    descriptors,
    navigation,
}) => {
    const { sheetIsOpen } = useContext(BottomSheetContext);

    // if sheet is open, render nothing
    if (sheetIsOpen) {
        return null;
    }

    return (
        <View style={styles.wrapper}>
            <View style={[styles.container, state.index === 1 && styles.opaqueBackground]}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel?.toString() ??
                        options.title?.toString() ??
                        route.name;

                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            onPress={onPress}
                            style={[
                                styles.tabButton,
                                isFocused && styles.activeTabButton,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.tabText,
                                    isFocused && styles.activeTabText,
                                ]}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

export default CustomTabBar;

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 34 : 16,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    container: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // semi-transparent white
        borderRadius: Platform.select({ios: 28, android: 24, default: 24}),
        padding: Platform.select({ios: 4, android: 3, default: 3}),
        width: '90%',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: Platform.select({ios: 10, android: 8, default: 8}),
        borderRadius: Platform.select({ios: 25, android: 20, default: 20}),
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeTabButton: {
        backgroundColor: '#D3D3D3', // light grey for selected tab background
    },
    tabText: {
        color: '#666',
        fontWeight: '400',
    },
    activeTabText: {
        color: '#000',
        fontWeight: '700',
    },
    opaqueBackground: {
        backgroundColor: '#fff', // fully opaque white
    },
});
