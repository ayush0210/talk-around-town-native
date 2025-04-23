import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthContext } from '../context/AuthContext';
import RNFS from 'react-native-fs';

const API_BASE_URL = 'http://68.183.102.75:1337';

const ExportDataButton = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { userInfo } = React.useContext(AuthContext);

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: "ENACT Storage Permission",
          message: "ENACT needs access to your storage to download database exports",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error("Permission request error:", err);
      return false;
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Request permission first (for Android)
      // const hasPermission = await requestStoragePermission();
      // if (!hasPermission && Platform.OS === 'android') {
      //   Alert.alert('Permission Denied', 'Storage permission is required to download files');
      //   setIsExporting(false);
      //   return;
      // }
      
      // Request the export from the server
      const response = await fetch(`${API_BASE_URL}/api/admin/export-database`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userInfo.access_token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to export database');
      }
      
      // Get filename from content-disposition header or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'enact_database_export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // Determine the download path based on platform
      let downloadPath;
      if (Platform.OS === 'android') {
        downloadPath = `${RNFS.ExternalDirectoryPath}/${filename}`;
      } else {
        downloadPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
      }
      
      // Convert response to binary string
      const data = await response.text();
      
      // Write the file to storage
      await RNFS.writeFile(downloadPath, data, 'base64');
      
      // Show success message with file location
      Alert.alert(
        'Export Successful',
        `Database exported to ${downloadPath}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'There was an error exporting the database');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <TouchableOpacity
      style={styles.exportButton}
      onPress={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <>
          <Icon name="download" size={20} color="#FFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Export Database</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default ExportDataButton;