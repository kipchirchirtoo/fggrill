import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { systemApi } from '../../api/system.api';

const ROLE_COLORS: Record<string, string> = {
  super_admin: colors.danger.DEFAULT,
  superadmin: colors.danger.DEFAULT,
  general_manager: colors.warning.DEFAULT,
  central_storekeeper: colors.primary.DEFAULT,
  branch_storekeeper: colors.info.DEFAULT,
  cashier: colors.success.DEFAULT,
  receptionist: colors.accent.DEFAULT,
};

const UserManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/users
      const data = await systemApi.users();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setFiltered(users); return; }
    setFiltered(users.filter(u =>
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(q.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(q.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(q.toLowerCase())
    ));
  };

  const toggleActive = (u: any) => {
    Alert.alert(
      u.is_active ? 'Deactivate User' : 'Activate User',
      `${u.is_active ? 'Deactivate' : 'Activate'} ${u.first_name} ${u.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              // PUT /api/users/:id
              await systemApi.updateUser(u.id, { is_active: !u.is_active });
              const updated = users.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x);
              setUsers(updated);
              setFiltered(updated.filter(x =>
                !search || `${x.first_name} ${x.last_name}`.toLowerCase().includes(search.toLowerCase())
              ));
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to update user');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const role = item.role || 'unknown';
    const roleColor = ROLE_COLORS[role] || colors.text.tertiary;
    const initials = `${(item.first_name || '?')[0]}${(item.last_name || '?')[0]}`.toUpperCase();

    return (
      <Card style={[styles.card, !item.is_active && styles.cardInactive]}>
        <Card.Content>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: `${roleColor}20` }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.first_name} {item.last_name}</Text>
              <Text style={styles.email}>{item.email}</Text>
              {item.branch?.name && <Text style={styles.branch}>{item.branch.name}</Text>}
            </View>
            <TouchableOpacity onPress={() => toggleActive(item)} style={styles.toggleBtn}>
              <MaterialCommunityIcons
                name={item.is_active ? 'account-check' : 'account-off'}
                size={26}
                color={item.is_active ? colors.success.DEFAULT : colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}15` }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>
              {role.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Search users…" value={search} onChangeText={handleSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.header}>{filtered.length} users</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-group" size={60} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No users found'}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.lg, backgroundColor: colors.card },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  cardInactive: { opacity: 0.55 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, marginLeft: spacing.md },
  name: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  email: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  branch: { fontSize: 12, color: colors.accent.DEFAULT, marginTop: 2 },
  toggleBtn: { padding: spacing.sm },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default UserManagementScreen;
