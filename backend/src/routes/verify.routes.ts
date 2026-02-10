// Updated line 62 to handle branch property correctly
if (Array.isArray(branch) && branch.length > 0) {
    const branchName = branch[0].name;
} else if (branch && typeof branch.name === 'string') {
    const branchName = branch.name;
} else {
    // handle the case when branch is not valid
}