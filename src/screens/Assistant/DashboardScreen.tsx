import React, {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Dimensions,
  RefreshControl,
  Modal,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {LineChart, BarChart, PieChart} from 'react-native-chart-kit';
import {AuthContext, AuthContextType} from '../../context/AuthContext';
import {Alert, Share} from 'react-native';
import {BASE_URL} from '../../config';
import RNFS from 'react-native-fs';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DashboardData {
  summary: {
    users: number;
    children: number;
    locations: number;
    notifications: number;
    sessions: number;
    tips: number;
  };
  userTimeline: {date: string; count: number}[];
  childrenAges: {age: number; count: number}[];
  locationTypes: {type: string; count: number}[];
  notificationTimes: {hour: number; count: number}[];
  topLocations: {name: string; notification_count: number}[];
  topUsers: {id: number; name: string; email: string; child_count: number}[];
  recentActivity: {
    recentUsers: {
      id: number;
      name: string;
      email: string;
      created_at: string;
    }[];
    recentNotifications: {
      id: number;
      timestamp: string;
      user_name: string;
      location_name: string;
    }[];
  };
}

const API_BASE_URL = BASE_URL;
const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.7,
  decimalPlaces: 0,
};

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const {userInfo} = useContext<AuthContextType>(AuthContext);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState<Date | null>(null);
  const [exportDateTo, setExportDateTo] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const {isAdmin} = useContext(AuthContext);
  const [pendingActivities, setPendingActivities] = useState<
    {id: number; name: string; domains: string[]; submitted_by_name: string; submitted_by_email: string; created_at: string}[]
  >([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const exportToExcel = async () => {
    setShowExportModal(false);
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (exportDateFrom) {params.append('dateFrom', exportDateFrom.toISOString().split('T')[0]);}
      if (exportDateTo) {params.append('dateTo', exportDateTo.toISOString().split('T')[0]);}
      const response = await fetch(
        `${API_BASE_URL}/api/admin/export/excel?${params.toString()}`,
        {headers: {Authorization: `Bearer ${userInfo.access_token}`}},
      );
      if (!response.ok) {throw new Error('Export request failed');}
      const {data, filename} = await response.json();
      if (Platform.OS === 'android') {
        const downloadPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
        await RNFS.writeFile(downloadPath, data, 'base64');
        Alert.alert('Export Complete', `File saved to Downloads/${filename}`);
      } else {
        const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
        await RNFS.writeFile(path, data, 'base64');
        await Share.share({title: 'ENACT Dashboard Export', url: `file://${path}`});
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export data to Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert(
        'Access Denied',
        "You don't have permission to access the dashboard.",
        [{text: 'OK', onPress: () => navigation.goBack()}],
      );
    } else if (userInfo?.access_token) {
      fetchDashboardData();
    }
  }, [isAdmin, userInfo?.access_token, navigation]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      // Fetch summary data
      const summaryRes = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
        headers: {
          Authorization: `Bearer ${userInfo.access_token}`,
        },
      });
      try {
        const summaryRes = await fetch(
          `${API_BASE_URL}/api/dashboard/summary`,
          {
            headers: {
              Authorization: `Bearer ${userInfo.access_token}`,
            },
          },
        );

        console.log('Summary endpoint status:', summaryRes.status);

        if (!summaryRes.ok) {
          const errorText = await summaryRes.text();
          console.error('Summary endpoint error:', errorText);
          throw new Error(
            `Summary endpoint failed: ${summaryRes.status} - ${errorText}`,
          );
        }

        // Continue with other endpoints...
      } catch (error) {
        if (error instanceof Error) {
          console.error('Detailed fetch error:', error.message);
        } else {
          console.error('Detailed fetch error:', error);
        }
        setIsLoading(false);
        setRefreshing(false);
      }

      // Fetch user timeline
      const userTimelineRes = await fetch(
        `${API_BASE_URL}/api/dashboard/users/timeline`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch children ages
      const childrenAgesRes = await fetch(
        `${API_BASE_URL}/api/dashboard/children/ages`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch location types
      const locationTypesRes = await fetch(
        `${API_BASE_URL}/api/dashboard/locations/types`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch notification times
      const notificationTimesRes = await fetch(
        `${API_BASE_URL}/api/dashboard/notifications/time`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch top locations
      const topLocationsRes = await fetch(
        `${API_BASE_URL}/api/dashboard/locations/usage`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch top users
      const topUsersRes = await fetch(
        `${API_BASE_URL}/api/dashboard/users/children`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Fetch recent activity
      const recentActivityRes = await fetch(
        `${API_BASE_URL}/api/dashboard/recent-activity`,
        {
          headers: {
            Authorization: `Bearer ${userInfo.access_token}`,
          },
        },
      );

      // Process all responses
      if (
        !summaryRes.ok ||
        !userTimelineRes.ok ||
        !childrenAgesRes.ok ||
        !locationTypesRes.ok ||
        !notificationTimesRes.ok ||
        !topLocationsRes.ok ||
        !topUsersRes.ok ||
        !recentActivityRes.ok
      ) {
        throw new Error('One or more API requests failed');
      }

      const summary = await summaryRes.json();
      const userTimeline = await userTimelineRes.json();
      const childrenAges = await childrenAgesRes.json();
      const locationTypes = await locationTypesRes.json();
      const notificationTimes = await notificationTimesRes.json();
      const topLocations = await topLocationsRes.json();
      const topUsers = await topUsersRes.json();
      const recentActivity = await recentActivityRes.json();

      setDashboardData({
        summary,
        userTimeline,
        childrenAges,
        locationTypes,
        notificationTimes,
        topLocations,
        topUsers,
        recentActivity,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // useEffect(() => {
  //   if (userInfo?.access_token) {
  //     fetchDashboardData();
  //   }
  // }, [userInfo?.access_token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  // Prepare data for charts
  const prepareUserTimelineData = () => {
    if (!dashboardData?.userTimeline || dashboardData.userTimeline.length === 0)
      {return null;}

    // Take only the last 7 entries for better display
    const timelineData = dashboardData.userTimeline.slice(-7);

    return {
      labels: timelineData.map(item => {
        const date = new Date(item.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: timelineData.map(item => item.count),
          color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const prepareChildrenAgeData = () => {
    if (!dashboardData?.childrenAges || dashboardData.childrenAges.length === 0)
      {return null;}

    return {
      labels: dashboardData.childrenAges.map(item =>
        item.age === 0 ? '<1y' : `${item.age}y`,
      ),
      datasets: [
        {
          data: dashboardData.childrenAges.map(item => item.count),
        },
      ],
    };
  };

  const prepareLocationTypesData = () => {
    if (
      !dashboardData?.locationTypes ||
      dashboardData.locationTypes.length === 0
    )
      {return null;}

    const colors = [
      '#FF6384',
      '#36A2EB',
      '#FFCE56',
      '#4BC0C0',
      '#9966FF',
      '#FF9F40',
    ];

    return dashboardData.locationTypes.slice(0, 6).map((item, index) => ({
      name: item.type || 'Unknown',
      count: item.count,
      color: colors[index % colors.length],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    }));
  };

  const prepareNotificationTimesData = () => {
    if (
      !dashboardData?.notificationTimes ||
      dashboardData.notificationTimes.length === 0
    )
      {return null;}

    // Create a full 24-hour array with zeros for missing hours
    const hourlyData = Array(24).fill(0);

    // Fill in the actual data
    dashboardData.notificationTimes.forEach(item => {
      hourlyData[item.hour] = item.count;
    });

    return {
      labels: ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'],
      datasets: [
        {
          data: [
            hourlyData[0],
            hourlyData[3],
            hourlyData[6],
            hourlyData[9],
            hourlyData[12],
            hourlyData[15],
            hourlyData[18],
            hourlyData[21],
          ],
        },
      ],
    };
  };

  if (isLoading && !dashboardData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading dashboard data...</Text>
      </SafeAreaView>
    );
  }

  const userTimelineData = prepareUserTimelineData();
  const childrenAgeData = prepareChildrenAgeData();
  const locationTypesData = prepareLocationTypesData();
  const notificationTimesData = prepareNotificationTimesData();

  const renderOverviewTab = () => (
    <>
      {/* App Summary Cards */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>App Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Icon name="people" size={24} color="#4A90E2" />
            <Text style={styles.summaryNumber}>
              {dashboardData?.summary.users || 0}
            </Text>
            <Text style={styles.summaryLabel}>Users</Text>
          </View>

          <View style={styles.summaryCard}>
            <Icon name="child-care" size={24} color="#FF9500" />
            <Text style={styles.summaryNumber}>
              {dashboardData?.summary.children || 0}
            </Text>
            <Text style={styles.summaryLabel}>Children</Text>
          </View>

          <View style={styles.summaryCard}>
            <Icon name="place" size={24} color="#34C759" />
            <Text style={styles.summaryNumber}>
              {dashboardData?.summary.locations || 0}
            </Text>
            <Text style={styles.summaryLabel}>Locations</Text>
          </View>

          <View style={styles.summaryCard}>
            <Icon name="notifications" size={24} color="#FF3B30" />
            <Text style={styles.summaryNumber}>
              {dashboardData?.summary.notifications || 0}
            </Text>
            <Text style={styles.summaryLabel}>Notifications</Text>
          </View>
        </View>
      </View>

      {/* User Registration Chart */}
      {userTimelineData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>
            User Registrations (Last 7 Days)
          </Text>
          <LineChart
            data={userTimelineData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Children Age Chart */}
      {childrenAgeData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Children Age Distribution</Text>
          <BarChart
            data={childrenAgeData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            verticalLabelRotation={0}
            yAxisLabel=""
            yAxisSuffix=""
          />
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        <Text style={styles.subsectionTitle}>New Users</Text>
        {dashboardData?.recentActivity.recentUsers.map((user, index) => (
          <View key={`user-${index}`} style={styles.activityItem}>
            <Icon
              name="person"
              size={20}
              color="#4A90E2"
              style={styles.activityIcon}
            />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{user.name}</Text>
              <Text style={styles.activitySubtitle}>{user.email}</Text>
              <Text style={styles.activityDate}>
                {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}

        <Text style={[styles.subsectionTitle, {marginTop: 16}]}>
          Recent Notifications
        </Text>
        {dashboardData?.recentActivity.recentNotifications.map(
          (notification, index) => (
            <View key={`notif-${index}`} style={styles.activityItem}>
              <Icon
                name="notifications"
                size={20}
                color="#FF3B30"
                style={styles.activityIcon}
              />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {notification.location_name}
                </Text>
                <Text style={styles.activitySubtitle}>
                  User: {notification.user_name}
                </Text>
                <Text style={styles.activityDate}>
                  {new Date(notification.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ),
        )}
      </View>
    </>
  );

  const renderUsersTab = () => (
    <>
      {/* User Timeline */}
      {userTimelineData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>User Registrations Over Time</Text>
          <LineChart
            data={userTimelineData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Top Users */}
      <View style={styles.tableContainer}>
        <Text style={styles.chartTitle}>Top Users by Number of Children</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableColumn, styles.tableHeaderText, {flex: 2}]}>
            User
          </Text>
          <Text style={[styles.tableColumn, styles.tableHeaderText, {flex: 2}]}>
            Email
          </Text>
          <Text
            style={[
              styles.tableColumn,
              styles.tableHeaderText,
              {flex: 1, textAlign: 'center'},
            ]}>
            Children
          </Text>
        </View>
        {dashboardData?.topUsers.map((user, index) => (
          <View key={index} style={styles.tableRow}>
            <Text
              style={[styles.tableColumn, {flex: 2}]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {user.name}
            </Text>
            <Text
              style={[styles.tableColumn, {flex: 2}]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {user.email}
            </Text>
            <Text style={[styles.tableColumn, {flex: 1, textAlign: 'center'}]}>
              {user.child_count}
            </Text>
          </View>
        ))}
      </View>

      {/* Recent Users */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Recently Registered Users</Text>
        {dashboardData?.recentActivity.recentUsers.map((user, index) => (
          <View key={`recent-user-${index}`} style={styles.activityItem}>
            <Icon
              name="person"
              size={20}
              color="#4A90E2"
              style={styles.activityIcon}
            />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{user.name}</Text>
              <Text style={styles.activitySubtitle}>{user.email}</Text>
              <Text style={styles.activityDate}>
                {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );

  const renderChildrenTab = () => (
    <>
      {/* Children Age Distribution */}
      {childrenAgeData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Children Age Distribution</Text>
          <BarChart
            data={childrenAgeData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            verticalLabelRotation={0}
            yAxisLabel=""
            yAxisSuffix="y"
          />
        </View>
      )}

      {/* Children Stats */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Children Statistics</Text>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Children:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.children || 0}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average Children per User:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.users
              ? (
                  dashboardData.summary.children / dashboardData.summary.users
                ).toFixed(1)
              : 0}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Most Common Age:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.childrenAges.length
              ? dashboardData.childrenAges.reduce((a, b) =>
                  a.count > b.count ? a : b,
                ).age
              : 'N/A'}{' '}
            years
          </Text>
        </View>
      </View>
    </>
  );

  const renderLocationsTab = () => (
    <>
      {/* Location Types Pie Chart */}
      {locationTypesData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Location Types</Text>
          <PieChart
            data={locationTypesData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      )}

      {/* Top Locations Table */}
      <View style={styles.tableContainer}>
        <Text style={styles.chartTitle}>Most Used Locations</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableColumn, styles.tableHeaderText, {flex: 3}]}>
            Location
          </Text>
          <Text
            style={[
              styles.tableColumn,
              styles.tableHeaderText,
              {flex: 1, textAlign: 'center'},
            ]}>
            Uses
          </Text>
        </View>
        {dashboardData?.topLocations.map((location, index) => (
          <View key={index} style={styles.tableRow}>
            <Text
              style={[styles.tableColumn, {flex: 3}]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {location.name}
            </Text>
            <Text style={[styles.tableColumn, {flex: 1, textAlign: 'center'}]}>
              {location.notification_count}
            </Text>
          </View>
        ))}
      </View>

      {/* Location Stats */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Location Statistics</Text>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Locations:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.locations || 0}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average Locations per User:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.users
              ? (
                  dashboardData.summary.locations / dashboardData.summary.users
                ).toFixed(1)
              : 0}
          </Text>
        </View>
      </View>
    </>
  );

  const renderNotificationsTab = () => (
    <>
      {/* Notification Times Chart */}
      {notificationTimesData && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Notifications by Time of Day</Text>
          <BarChart
            data={notificationTimesData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            verticalLabelRotation={0}
            yAxisLabel=""
            yAxisSuffix="y"
          />
        </View>
      )}

      {/* Recent Notifications */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Recent Notifications</Text>
        {dashboardData?.recentActivity.recentNotifications.map(
          (notification, index) => (
            <View key={`notif-detail-${index}`} style={styles.activityItem}>
              <Icon
                name="notifications"
                size={20}
                color="#FF3B30"
                style={styles.activityIcon}
              />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>
                  {notification.location_name}
                </Text>
                <Text style={styles.activitySubtitle}>
                  User: {notification.user_name}
                </Text>
                <Text style={styles.activityDate}>
                  {new Date(notification.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ),
        )}
      </View>

      {/* Notification Stats */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Notification Statistics</Text>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Notifications:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.notifications || 0}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Notifications per Location:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.locations
              ? (
                  dashboardData.summary.notifications /
                  dashboardData.summary.locations
                ).toFixed(1)
              : 0}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Notifications per User:</Text>
          <Text style={styles.statValue}>
            {dashboardData?.summary.users
              ? (
                  dashboardData.summary.notifications /
                  dashboardData.summary.users
                ).toFixed(1)
              : 0}
          </Text>
        </View>
      </View>
    </>
  );
  const fetchPendingActivities = async () => {
    if (!userInfo?.access_token) {return;}
    setActivitiesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/activities/pending`, {
        headers: {Authorization: `Bearer ${userInfo.access_token}`},
      });
      if (res.ok) {
        const data = await res.json();
        setPendingActivities(data);
      }
    } catch (err) {
      console.error('Error fetching pending activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const handleActivityDecision = async (id: number, action: 'approve' | 'reject') => {
    if (!userInfo?.access_token) {return;}
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/activities/${id}/${action}`, {
        method: 'PATCH',
        headers: {Authorization: `Bearer ${userInfo.access_token}`},
      });
      if (res.ok) {
        setPendingActivities(prev => prev.filter(a => a.id !== id));
        Alert.alert('Done', `Activity ${action === 'approve' ? 'approved' : 'rejected'}.`);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not update activity. Please try again.');
    }
  };

  const renderActivitiesTab = () => (
    <View style={styles.sectionContainer}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
        <Text style={styles.sectionTitle}>Pending Activities</Text>
        <TouchableOpacity onPress={fetchPendingActivities}>
          <Icon name="refresh" size={20} color="#4A90E2" />
        </TouchableOpacity>
      </View>
      {activitiesLoading ? (
        <ActivityIndicator color="#4A90E2" style={{marginTop: 20}} />
      ) : pendingActivities.length === 0 ? (
        <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>
          No pending activity submissions.
        </Text>
      ) : (
        pendingActivities.map(activity => (
          <View key={activity.id} style={styles.activityItem}>
            <View style={{flex: 1}}>
              <Text style={[styles.activityTitle, {fontSize: 15}]}>{activity.name}</Text>
              <Text style={styles.activitySubtitle}>
                By: {activity.submitted_by_name} ({activity.submitted_by_email})
              </Text>
              {activity.domains?.length > 0 && (
                <Text style={styles.activitySubtitle}>
                  Domains: {activity.domains.join(', ')}
                </Text>
              )}
              <Text style={styles.activityDate}>
                {new Date(activity.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={{gap: 8}}>
              <TouchableOpacity
                style={{backgroundColor: '#34C759', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6}}
                onPress={() => handleActivityDecision(activity.id, 'approve')}>
                <Text style={{color: 'white', fontWeight: '600', fontSize: 13}}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6}}
                onPress={() => handleActivityDecision(activity.id, 'reject')}>
                <Text style={{color: 'white', fontWeight: '600', fontSize: 13}}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.accessDeniedContainer}>
        <StatusBar barStyle="light-content" />
        <Icon name="lock" size={64} color="#FF3B30" />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedMessage}>
          You don't have permission to view this dashboard.
        </Text>
        <TouchableOpacity
          style={styles.accessDeniedButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.accessDeniedButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#4A90E2', '#357ABD']}
        style={styles.headerGradient}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ENACT Dashboard</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconButton} onPress={onRefresh}>
              <Icon name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => setShowExportModal(true)}
              disabled={isExporting}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="file-download" size={22} color="#FFFFFF" />
              )}
              <Text style={styles.exportButtonText}>
                {isExporting ? 'Exporting...' : 'Export'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'overview' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('overview')}>
            <Icon
              name="dashboard"
              size={20}
              color={activeTab === 'overview' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'overview' && styles.activeTabText,
              ]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'users' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('users')}>
            <Icon
              name="people"
              size={20}
              color={activeTab === 'users' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'users' && styles.activeTabText,
              ]}>
              Users
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'children' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('children')}>
            <Icon
              name="child-care"
              size={20}
              color={activeTab === 'children' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'children' && styles.activeTabText,
              ]}>
              Children
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'locations' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('locations')}>
            <Icon
              name="place"
              size={20}
              color={activeTab === 'locations' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'locations' && styles.activeTabText,
              ]}>
              Locations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'notifications' && styles.activeTab,
            ]}
            onPress={() => setActiveTab('notifications')}>
            <Icon
              name="notifications"
              size={20}
              color={activeTab === 'notifications' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'notifications' && styles.activeTabText,
              ]}>
              Notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'activities' && styles.activeTab,
            ]}
            onPress={() => {
              setActiveTab('activities');
              fetchPendingActivities();
            }}>
            <Icon
              name="local-activity"
              size={20}
              color={activeTab === 'activities' ? '#4A90E2' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'activities' && styles.activeTabText,
              ]}>
              Activities
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.container}>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'children' && renderChildrenTab()}
          {activeTab === 'locations' && renderLocationsTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'activities' && renderActivitiesTab()}
        </View>
      </ScrollView>

      {/* Export Filter Modal */}
      <Modal visible={showExportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.exportModal}>
            <Text style={styles.exportModalTitle}>Export Options</Text>

            <Text style={styles.exportSectionLabel}>Date Range (optional)</Text>
            <Text style={styles.exportDateHint}>Filters Users (registered) and Notifications</Text>
            <View style={styles.exportDateRow}>
              <View style={styles.exportDateField}>
                <Text style={styles.exportDateFieldLabel}>From</Text>
                <TouchableOpacity
                  style={styles.exportDateInput}
                  onPress={() => setShowFromPicker(true)}>
                  <Text style={exportDateFrom ? styles.exportDateValue : styles.exportDatePlaceholder}>
                    {exportDateFrom ? exportDateFrom.toLocaleDateString() : 'Any date'}
                  </Text>
                  <Icon name="calendar-today" size={16} color="#888" />
                </TouchableOpacity>
                {exportDateFrom && (
                  <TouchableOpacity onPress={() => setExportDateFrom(null)}>
                    <Text style={styles.exportDateClear}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.exportDateField}>
                <Text style={styles.exportDateFieldLabel}>To</Text>
                <TouchableOpacity
                  style={styles.exportDateInput}
                  onPress={() => setShowToPicker(true)}>
                  <Text style={exportDateTo ? styles.exportDateValue : styles.exportDatePlaceholder}>
                    {exportDateTo ? exportDateTo.toLocaleDateString() : 'Any date'}
                  </Text>
                  <Icon name="calendar-today" size={16} color="#888" />
                </TouchableOpacity>
                {exportDateTo && (
                  <TouchableOpacity onPress={() => setExportDateTo(null)}>
                    <Text style={styles.exportDateClear}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {showFromPicker && (
              <DateTimePicker
                value={exportDateFrom || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => { setShowFromPicker(false); if (date) {setExportDateFrom(date);} }}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={exportDateTo || new Date()}
                mode="date"
                display="default"
                onChange={(_, date) => { setShowToPicker(false); if (date) {setExportDateTo(date);} }}
              />
            )}

            <View style={styles.exportModalActions}>
              <TouchableOpacity
                style={styles.exportCancelBtn}
                onPress={() => setShowExportModal(false)}>
                <Text style={styles.exportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportConfirmBtn}
                onPress={exportToExcel}>
                <Icon name="file-download" size={18} color="#fff" />
                <Text style={styles.exportConfirmText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerGradient: {
    paddingBottom: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4A90E2',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabScroll: {
    paddingHorizontal: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4A90E2',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    padding: 16,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: '#444',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
    color: '#333',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  chart: {
    borderRadius: 12,
    paddingRight: 20,
    marginLeft: -10,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  accessDeniedButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  accessDeniedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  tableColumn: {
    fontSize: 14,
    color: '#444',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#333',
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statLabel: {
    fontSize: 15,
    color: '#666',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  exportModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  exportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  exportSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  exportCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  exportCheckLabel: {
    fontSize: 15,
    color: '#333',
  },
  exportDateHint: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
  },
  exportDateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportDateField: {
    flex: 1,
  },
  exportDateFieldLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  exportDateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exportDateValue: {
    fontSize: 14,
    color: '#333',
  },
  exportDatePlaceholder: {
    fontSize: 14,
    color: '#aaa',
  },
  exportDateClear: {
    fontSize: 12,
    color: '#4A90E2',
    marginTop: 4,
  },
  exportModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  exportCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  exportCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  exportConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
export default DashboardScreen;
