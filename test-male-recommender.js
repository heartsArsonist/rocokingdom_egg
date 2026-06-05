const assert = require('node:assert/strict');
const { recommendMalePlans, recommendMales } = require('./male-recommender');

const pets = [
    { id: 1, name: '动物公', egg_groups: [6], special_tags: [] },
    { id: 2, name: '妖精公', egg_groups: [7], special_tags: [] },
    { id: 3, name: '双组公', egg_groups: [6, 7], special_tags: [] },
    { id: 4, name: '仅雌双组', egg_groups: [6, 7], special_tags: [1002] },
    { id: 5, name: '不可孵蛋', egg_groups: [6, 7], special_tags: [300] },
    { id: 6, name: '动物母', egg_groups: [6], special_tags: [] },
    { id: 7, name: '妖精母', egg_groups: [7], special_tags: [] },
    { id: 8, name: '仅雌矿石母', egg_groups: [11], special_tags: [1002] },
    { id: 9, name: '矿石公', egg_groups: [11], special_tags: [] },
    { id: 10, name: '仅雌海洋母', egg_groups: [13], special_tags: [1002] },
    { id: 11, name: '双组公备选', egg_groups: [6, 7], special_tags: [] }
];

{
    const result = recommendMales(pets, [6, 7]);
    assert.deepEqual(result.males.map(male => male.id), [3]);
    assert.deepEqual(result.uncoveredFemaleIds, []);
}

{
    const result = recommendMales(pets, [6, 7, 8]);
    assert.deepEqual(result.males.map(male => male.id), [3, 9]);
    assert.deepEqual(result.uncoveredFemaleIds, []);
}

{
    const result = recommendMales(pets, [6, 7, 10]);
    assert.deepEqual(result.males.map(male => male.id), [3]);
    assert.deepEqual(result.uncoveredFemaleIds, [10]);
}

{
    const result = recommendMales(pets, []);
    assert.deepEqual(result, { males: [], coveredFemaleIds: [], uncoveredFemaleIds: [] });
}

{
    const plans = recommendMalePlans(pets, [6, 7], { maxPlans: 4 });
    assert.deepEqual(plans.map(plan => plan.males.map(male => male.id)), [
        [3],
        [11],
        [1, 2],
        [1, 7]
    ]);
    assert.equal(plans[0].isOptimal, true);
    assert.equal(plans[2].isOptimal, false);
}

console.log('male recommender tests passed');
