import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final bookingsProvider =
    FutureProvider.family<List<Booking>, String?>((ref, status) async {
  final repo = ref.read(receptionRepositoryProvider);
  return repo.getBookings(status: status);
});

final roomsProvider = FutureProvider<List<Room>>((ref) async {
  final repo = ref.read(receptionRepositoryProvider);
  return repo.getRooms();
});

final guestsProvider = FutureProvider<List<Guest>>((ref) async {
  final repo = ref.read(receptionRepositoryProvider);
  return repo.getGuests();
});
