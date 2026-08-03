import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';
import '../../shared/models/posting_result.dart';

final storeIssueRepositoryProvider = Provider<StoreIssueRepository>((ref) {
  return StoreIssueRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreIssueRepository {
  StoreIssueRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<PostingResult> recordDepartmentIssue(Map<String, dynamic> data) async {
    final response = await _legacy.recordDepartmentIssue(data);
    return PostingResult.fromMap(Map<String, dynamic>.from(response));
  }

  Future<void> issueDepartmentRequest(String id, {String? notes}) {
    return _legacy.issueDepartmentRequest(id, notes: notes);
  }
}
