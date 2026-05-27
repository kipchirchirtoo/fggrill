import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final guestServiceProvider = Provider<GuestService>((ref) {
  return GuestService(ref.watch(dioProvider));
});

class GuestService extends BaseApiService {
  GuestService(super.dio);

  // GET /api/guests
  Future<Map<String, dynamic>> getGuests({
    String? search,
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (search != null) 'search': search,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/guests', queryParameters: query);
    return response;
  }

  // GET /api/guests/:id
  Future<Map<String, dynamic>> getGuest(String id) async {
    final response = await get<Map<String, dynamic>>('/guests/$id');
    return response;
  }

  // POST /api/guests
  Future<Map<String, dynamic>> createGuest(
      Map<String, dynamic> guestData) async {
    final response =
        await post<Map<String, dynamic>>('/guests', data: guestData);
    return response;
  }

  // PUT /api/guests/:id
  Future<Map<String, dynamic>> updateGuest(
      String id, Map<String, dynamic> guestData) async {
    final response =
        await put<Map<String, dynamic>>('/guests/$id', data: guestData);
    return response;
  }

  // GET /api/guests/:id/bookings
  Future<Map<String, dynamic>> getGuestBookings(String id) async {
    final response = await get<Map<String, dynamic>>('/guests/$id/bookings');
    return response;
  }

  // GET /api/guests/:id/folio
  Future<Map<String, dynamic>> getGuestFolio(String id) async {
    final response = await get<Map<String, dynamic>>('/guests/$id/folio');
    return response;
  }

  // GET /api/guests/:id/preferences
  Future<Map<String, dynamic>> getGuestPreferences(String id) async {
    final response = await get<Map<String, dynamic>>('/guests/$id/preferences');
    return response;
  }

  // PUT /api/guests/:id/preferences
  Future<Map<String, dynamic>> updateGuestPreferences(
      String id, Map<String, dynamic> preferences) async {
    final response = await put<Map<String, dynamic>>('/guests/$id/preferences',
        data: preferences);
    return response;
  }

  // GET /api/guests/search
  Future<Map<String, dynamic>> searchGuests(String query) async {
    final response = await get<Map<String, dynamic>>('/guests/search',
        queryParameters: {'q': query});
    return response;
  }

  // GET /api/guests/stats
  Future<Map<String, dynamic>> getGuestStats({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/guests/stats',
        queryParameters: query);
    return response;
  }

  // POST /api/guests/:id/notes
  Future<Map<String, dynamic>> addGuestNote(String id, String note) async {
    final response = await post<Map<String, dynamic>>(
      '/guests/$id/notes',
      data: {'note': note},
    );
    return response;
  }

  // GET /api/guests/:id/notes
  Future<List<dynamic>> getGuestNotes(String id) async {
    final response = await get<List<dynamic>>('/guests/$id/notes');
    return response;
  }

  // GET /api/guests/portal/activity
  Future<Map<String, dynamic>> getPortalActivity({String? guestId}) async {
    final query = {if (guestId != null) 'guestId': guestId};
    final response = await get<Map<String, dynamic>>('/guest-portal/activity',
        queryParameters: query);
    return response;
  }
}
