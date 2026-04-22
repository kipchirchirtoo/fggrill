# FamousGate Mobile - Development Guide

## Quick Start

### 1. Initial Setup

```bash
# Clone and navigate to mobile directory
cd famousgate-mobile

# Install dependencies
npm install

# Start development server
npm start
```

### 2. Configure Backend Connection

Update `.env.development` with your local IP:

```env
API_BASE_URL=http://192.168.1.XXX:5000/api
```

Find your IP:
- **Windows**: `ipconfig` → Look for IPv4 Address
- **Mac/Linux**: `ifconfig` → Look for inet address

### 3. Test Credentials

Use these test accounts for development:

**Central Storekeeper**:
- Email: `central@famousgate.com`
- Password: `password123`

**Branch Storekeeper**:
- Email: `branch@famousgate.com`
- Password: `password123`

**Cashier**:
- Email: `cashier@famousgate.com`
- Password: `password123`

**Superadmin**:
- Email: `admin@famousgate.com`
- Password: `password123`

## Development Workflow

### Running the App

**Start Metro bundler**:
```bash
npm start
```

**Run on iOS Simulator**:
```bash
npm run ios
# or press 'i' in Metro bundler
```

**Run on Android Emulator**:
```bash
npm run android
# or press 'a' in Metro bundler
```

**Run on Physical Device**:
1. Install Expo Go from App Store/Play Store
2. Scan QR code from Metro bundler
3. App will load on your device

### Code Quality

**Linting**:
```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

**Type Checking**:
```bash
npm run type-check
```

**Format Code**:
```bash
npx prettier --write "src/**/*.{ts,tsx}"
```

## Architecture

### State Management

**Zustand Stores**:
- `auth.store.ts` - Authentication state
- Add more stores as needed for complex state

**Local State**:
- Use `useState` for component-specific state
- Use `useCallback` for memoized functions
- Use `useMemo` for expensive computations

### API Integration

**API Client** (`src/api/client.ts`):
- Axios instance with interceptors
- Auto-attaches JWT token
- Auto-refreshes on 401
- Handles network errors

**API Modules**:
- `auth.api.ts` - Authentication
- `cashier.api.ts` - Cashier operations
- `dispatch.api.ts` - Dispatch management
- `inventory.api.ts` - Inventory operations
- `system.api.ts` - System data

**Creating New API Module**:

```typescript
// src/api/example.api.ts
import apiClient from './client';

export const exampleApi = {
  getItems: async () => {
    const { data } = await apiClient.get('/example/items');
    return data;
  },
  
  createItem: async (payload: any) => {
    const { data } = await apiClient.post('/example/items', payload);
    return data;
  },
};
```

### Navigation

**Stack Navigation**:
- Used for hierarchical navigation
- Each role has its own stack

**Tab Navigation**:
- Used for main sections within each role
- Bottom tabs for easy access

**Adding New Screen**:

1. Create screen component:
```typescript
// src/screens/example/ExampleScreen.tsx
import React from 'react';
import { View, Text } from 'react-native';

const ExampleScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  return (
    <View>
      <Text>Example Screen</Text>
    </View>
  );
};

export default ExampleScreen;
```

2. Add to navigator:
```typescript
// src/navigation/RootNavigator.tsx
import ExampleScreen from '../screens/example/ExampleScreen';

// In appropriate navigator:
<Stack.Screen 
  name="Example" 
  component={ExampleScreen} 
  options={{ title: 'Example' }} 
/>
```

### Styling

**Theme System**:
- Colors: `src/theme/colors.ts`
- Typography: `src/theme/typography.ts`
- Spacing: Consistent spacing scale
- Shadows: Pre-defined shadow styles

**Component Styling**:

```typescript
import { StyleSheet } from 'react-native';
import { colors, spacing, shadows } from '../../theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    ...shadows.md,
  },
});
```

### Forms

**Using React Hook Form**:

```typescript
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().positive('Must be positive'),
});

type FormData = z.infer<typeof schema>;

const MyForm = () => {
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data);
  };

  return (
    <Controller
      control={control}
      name="name"
      render={({ field: { onChange, value } }) => (
        <TextInput
          value={value}
          onChangeText={onChange}
          error={!!errors.name}
        />
      )}
    />
  );
};
```

## Common Patterns

### Loading States

```typescript
const [loading, setLoading] = useState(false);

const loadData = async () => {
  setLoading(true);
  try {
    const data = await api.getData();
    setData(data);
  } catch (error) {
    showErrorAlert(error);
  } finally {
    setLoading(false);
  }
};

// In render:
{loading ? <LoadingScreen /> : <DataView />}
```

### Error Handling

```typescript
import { showErrorAlert, getErrorMessage } from '../utils/errorHandler';

try {
  await api.doSomething();
} catch (error) {
  showErrorAlert(error, 'Operation Failed');
}
```

### Pull to Refresh

```typescript
import { RefreshControl } from 'react-native';

<ScrollView
  refreshControl={
    <RefreshControl 
      refreshing={loading} 
      onRefresh={loadData} 
    />
  }
>
  {/* Content */}
</ScrollView>
```

### Empty States

```typescript
import { EmptyState } from '../components/common';

{items.length === 0 && (
  <EmptyState
    icon="inbox"
    title="No Items"
    message="There are no items to display"
    actionLabel="Add Item"
    onAction={() => navigation.navigate('AddItem')}
  />
)}
```

## Testing

### Manual Testing Checklist

**Authentication**:
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Token refresh on 401
- [ ] Logout clears session

**Navigation**:
- [ ] All tabs accessible
- [ ] Back navigation works
- [ ] Deep linking works
- [ ] Role-based routing correct

**Forms**:
- [ ] Validation messages show
- [ ] Submit button disabled when invalid
- [ ] Loading states during submission
- [ ] Success/error feedback

**API Integration**:
- [ ] Data loads correctly
- [ ] Error handling works
- [ ] Network errors handled
- [ ] Timeout handling

### Device Testing

Test on multiple devices:
- iOS Simulator (iPhone 14, iPhone SE)
- Android Emulator (Pixel 5, Samsung Galaxy)
- Physical devices (iOS and Android)

## Performance Optimization

### Best Practices

1. **Use FlatList for long lists**:
```typescript
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

2. **Memoize expensive computations**:
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

3. **Optimize images**:
```typescript
<Image 
  source={{ uri: imageUrl }}
  style={styles.image}
  resizeMode="cover"
  defaultSource={require('../assets/placeholder.png')}
/>
```

4. **Debounce search inputs**:
```typescript
import { debounce } from 'lodash';

const debouncedSearch = useMemo(
  () => debounce((query) => performSearch(query), 300),
  []
);
```

## Debugging

### React Native Debugger

1. Install React Native Debugger
2. Start app with `npm start`
3. Press `Cmd+D` (iOS) or `Cmd+M` (Android)
4. Select "Debug"

### Console Logs

```typescript
console.log('Debug info:', data);
console.error('Error:', error);
console.warn('Warning:', warning);
```

### Network Debugging

Enable network inspector in React Native Debugger to see all API calls.

### Common Issues

**Metro bundler won't start**:
```bash
npm start -- --clear
```

**App won't load on device**:
- Check device and computer on same network
- Verify firewall settings
- Try restarting Expo Go app

**Build errors**:
```bash
rm -rf node_modules
npm install
npm start -- --clear
```

## Deployment

### Building for Production

**iOS**:
```bash
eas build --platform ios --profile production
```

**Android**:
```bash
eas build --platform android --profile production
```

### App Store Submission

1. Build production version
2. Test thoroughly on TestFlight/Internal Testing
3. Prepare app store assets (screenshots, description)
4. Submit for review

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Zustand](https://github.com/pmndrs/zustand)

## Support

For issues or questions:
1. Check this guide
2. Review existing code patterns
3. Consult team lead
4. Create issue in project tracker
