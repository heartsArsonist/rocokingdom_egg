(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.MaleRecommender = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function hasCommonGroup(left, right) {
        return left.some(group => right.includes(group));
    }

    function isBreedableMaleCandidate(pet) {
        const groups = pet.egg_groups || [];
        const tags = pet.special_tags || [];
        return groups.length > 0 && !groups.includes(1) && !tags.includes(300) && !tags.includes(1002);
    }

    function compareCandidate(left, right) {
        if (left.coveredCount !== right.coveredCount) return right.coveredCount - left.coveredCount;
        if (left.pet.egg_groups.length !== right.pet.egg_groups.length) {
            return right.pet.egg_groups.length - left.pet.egg_groups.length;
        }
        return left.pet.id - right.pet.id;
    }

    function comparePlans(left, right) {
        if (!right) return -1;
        if (left.length !== right.length) return left.length - right.length;
        const leftScore = left.reduce((sum, candidate) => sum + candidate.coveredCount, 0);
        const rightScore = right.reduce((sum, candidate) => sum + candidate.coveredCount, 0);
        if (leftScore !== rightScore) return rightScore - leftScore;
        const leftIds = left.map(candidate => candidate.pet.id).sort((a, b) => a - b);
        const rightIds = right.map(candidate => candidate.pet.id).sort((a, b) => a - b);
        for (let index = 0; index < leftIds.length; index++) {
            if (leftIds[index] !== rightIds[index]) return leftIds[index] - rightIds[index];
        }
        return 0;
    }

    function planKey(plan) {
        return plan.map(candidate => candidate.pet.id).sort((a, b) => a - b).join(',');
    }

    function insertPlan(plans, plan, limit) {
        const key = planKey(plan);
        if (plans.some(existing => planKey(existing) === key)) return;
        plans.push(plan);
        plans.sort(comparePlans);
        if (plans.length > limit) plans.length = limit;
    }

    function bitCount(mask) {
        let count = 0;
        while (mask > 0) {
            count += mask & 1;
            mask >>>= 1;
        }
        return count;
    }

    function recommendMalePlans(pets, femaleIds, options = {}) {
        const maxPlans = options.maxPlans || 5;
        const variantsPerCoverage = options.variantsPerCoverage || 3;
        const plansPerMask = Math.max(maxPlans * 4, 12);
        const selectedFemaleIds = [...new Set(femaleIds)];
        const females = selectedFemaleIds
            .map(id => pets.find(pet => pet.id === id))
            .filter(Boolean);

        if (females.length === 0) {
            return [];
        }

        const candidatesByCoverageMask = new Map();
        for (const pet of pets) {
            if (!isBreedableMaleCandidate(pet)) continue;
            let coverageMask = 0;
            females.forEach((female, index) => {
                if (hasCommonGroup(pet.egg_groups, female.egg_groups || [])) coverageMask |= (1 << index);
            });
            if (coverageMask === 0) continue;
            const candidate = { pet, coverageMask, coveredCount: bitCount(coverageMask) };
            const candidates = candidatesByCoverageMask.get(coverageMask) || [];
            candidates.push(candidate);
            candidates.sort(compareCandidate);
            if (candidates.length > variantsPerCoverage) candidates.length = variantsPerCoverage;
            candidatesByCoverageMask.set(coverageMask, candidates);
        }

        const candidates = [...candidatesByCoverageMask.values()].flat().sort(compareCandidate);
        const plans = new Map([[0, [[]]]]);
        for (const candidate of candidates) {
            for (const [mask, existingPlans] of [...plans.entries()]) {
                for (const plan of existingPlans) {
                    const nextMask = mask | candidate.coverageMask;
                    if (nextMask === mask) continue;
                    const nextPlans = plans.get(nextMask) || [];
                    insertPlan(nextPlans, [...plan, candidate], plansPerMask);
                    plans.set(nextMask, nextPlans);
                }
            }
        }

        let bestMask = 0;
        for (const mask of plans.keys()) {
            const covered = bitCount(mask);
            const bestCovered = bitCount(bestMask);
            if (covered > bestCovered) bestMask = mask;
        }
        const bestCovered = bitCount(bestMask);
        const coveragePlans = [...plans.entries()]
            .filter(([mask]) => bitCount(mask) === bestCovered)
            .flatMap(([mask, matchingPlans]) => matchingPlans.map(plan => ({ mask, plan })));
        const minimumMaleCount = Math.min(...coveragePlans.map(({ plan }) => plan.length));
        const optimalPlans = coveragePlans
            .filter(({ plan }) => plan.length === minimumMaleCount)
            .sort((left, right) => comparePlans(left.plan, right.plan));
        const alternativePlans = coveragePlans
            .filter(({ plan }) => plan.length === minimumMaleCount + 1)
            .sort((left, right) => comparePlans(left.plan, right.plan));
        const optimalPlanLimit = Math.min(3, maxPlans);
        const selectedPlans = optimalPlans.slice(0, optimalPlanLimit);
        for (const alternative of alternativePlans) {
            if (selectedPlans.length >= maxPlans) break;
            selectedPlans.push(alternative);
        }
        for (const optimal of optimalPlans.slice(optimalPlanLimit)) {
            if (selectedPlans.length >= maxPlans) break;
            selectedPlans.push(optimal);
        }

        return selectedPlans.map(({ mask, plan }, index) => ({
            rank: index + 1,
            isOptimal: plan.length === minimumMaleCount,
            males: plan.map(candidate => ({
                    id: candidate.pet.id,
                    name: candidate.pet.name,
                    egg_groups: candidate.pet.egg_groups,
                    coveredFemaleIds: females
                        .filter((_, femaleIndex) => (candidate.coverageMask & (1 << femaleIndex)) !== 0)
                        .map(female => female.id)
                })),
            coveredFemaleIds: females
                .filter((_, femaleIndex) => (mask & (1 << femaleIndex)) !== 0)
                .map(female => female.id),
            uncoveredFemaleIds: females
                .filter((_, femaleIndex) => (mask & (1 << femaleIndex)) === 0)
                .map(female => female.id)
        }));
    }

    function recommendMales(pets, femaleIds) {
        return recommendMalePlans(pets, femaleIds, { maxPlans: 1 })[0]
            || { males: [], coveredFemaleIds: [], uncoveredFemaleIds: [] };
    }

    return { recommendMalePlans, recommendMales };
});
