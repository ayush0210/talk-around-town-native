import * as React from 'react';
import { StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type LocationList = {
    id: number,
    title: string,
    description: string,
    latitude: number,
    longitude: number,
    address: string
}

interface BottomSheetLocationItemProps {
    locations: LocationList;
    lastItem: boolean
    onDelete: () => void
}

const BottomSheetLocationItem: React.FC<BottomSheetLocationItemProps> = ({ locations, lastItem, onDelete }) => {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} key={locations.id}>
            <View style={{ flex: 1 }}>
                <Text style={styles.titleText}>{locations.title}</Text>
                <Text style={styles.descriptionText}>
                    {locations.description === '' ? 'Home' : locations.description}
                </Text>
                <Text style={styles.addressText}>
                    {locations.address.slice(0, -11) ?? 'Loading address...'}
                </Text>
            </View>

            <TouchableWithoutFeedback onPress={() => onDelete()} style={[styles.deleteBG]}>
                <Ionicons name="trash" size={20} color="red" />
            </TouchableWithoutFeedback>
        </View>
    );
};

const styles = StyleSheet.create({
    titleText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
        color: '#000',
    },
    descriptionText: {
        fontSize: 14,
        color: '#555',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        color: '#333',
    },
    deleteBG: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
});

export default BottomSheetLocationItem;
