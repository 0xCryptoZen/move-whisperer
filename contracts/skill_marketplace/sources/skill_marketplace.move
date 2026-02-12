/// Skill Marketplace - Decentralized skill trading with Walrus storage and Seal access control
///
/// Skills are stored as encrypted blobs on Walrus. Access is controlled via Seal:
/// - Free skills: anyone can decrypt
/// - Paid skills: only AccessCap holders can decrypt
module skill_marketplace::skill_marketplace {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::event;
    use sui::bcs;

    // ====== Error Codes ======

    const EInsufficientPayment: u64 = 1;
    const ENotCreator: u64 = 2;
    const ESkillNotPaid: u64 = 3;
    const ESkillIsFree: u64 = 4;
    const ENoAccess: u64 = 5;

    // ====== Objects ======

    /// On-chain skill record, created by the skill creator.
    /// Stores metadata and references the Walrus blob containing the skill content.
    public struct SkillRecord has key, store {
        id: UID,
        blob_id: u256,
        creator: address,
        title: vector<u8>,
        description: vector<u8>,
        price: u64,
        scene: vector<u8>,
        network: vector<u8>,
        package_id: vector<u8>,
        is_encrypted: bool,
        total_sales: u64,
        total_revenue: u64,
        created_at: u64,
    }

    /// Access capability NFT. Minted to buyers upon purchase.
    /// Possession of this object proves the holder has paid for access.
    public struct AccessCap has key, store {
        id: UID,
        skill_id: ID,
        blob_id: u256,
        purchased_at: u64,
    }

    // ====== Events ======

    public struct SkillPublished has copy, drop {
        skill_id: ID,
        creator: address,
        blob_id: u256,
        price: u64,
        is_encrypted: bool,
    }

    public struct SkillPurchased has copy, drop {
        skill_id: ID,
        buyer: address,
        access_cap_id: ID,
        price: u64,
    }

    public struct FreeSkillClaimed has copy, drop {
        skill_id: ID,
        claimer: address,
        access_cap_id: ID,
    }

    public struct PriceUpdated has copy, drop {
        skill_id: ID,
        old_price: u64,
        new_price: u64,
    }

    // ====== Entry Functions ======

    /// Publish a new skill to the marketplace.
    /// The skill content should already be uploaded to Walrus (optionally encrypted with Seal).
    public fun publish_skill(
        blob_id: u256,
        title: vector<u8>,
        description: vector<u8>,
        price: u64,
        scene: vector<u8>,
        network: vector<u8>,
        package_id: vector<u8>,
        is_encrypted: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let creator = ctx.sender();
        let skill = SkillRecord {
            id: object::new(ctx),
            blob_id,
            creator,
            title,
            description,
            price,
            scene,
            network,
            package_id,
            is_encrypted,
            total_sales: 0,
            total_revenue: 0,
            created_at: clock.timestamp_ms(),
        };

        event::emit(SkillPublished {
            skill_id: object::id(&skill),
            creator,
            blob_id,
            price,
            is_encrypted,
        });

        transfer::share_object(skill);
    }

    /// Purchase a paid skill. Payment goes directly to the creator.
    /// Mints an AccessCap to the buyer for Seal decryption authorization.
    public fun purchase_skill(
        skill: &mut SkillRecord,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(skill.price > 0, ESkillIsFree);
        assert!(coin::value(&payment) >= skill.price, EInsufficientPayment);

        // Split exact amount if overpaid
        let paid = coin::split(&mut payment, skill.price, ctx);
        // Send payment to creator
        transfer::public_transfer(paid, skill.creator);
        // Return change to buyer
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, ctx.sender());
        } else {
            coin::destroy_zero(payment);
        };

        // Update stats
        skill.total_sales = skill.total_sales + 1;
        skill.total_revenue = skill.total_revenue + skill.price;

        // Mint access cap to buyer
        let access_cap = AccessCap {
            id: object::new(ctx),
            skill_id: object::id(skill),
            blob_id: skill.blob_id,
            purchased_at: clock.timestamp_ms(),
        };

        event::emit(SkillPurchased {
            skill_id: object::id(skill),
            buyer: ctx.sender(),
            access_cap_id: object::id(&access_cap),
            price: skill.price,
        });

        transfer::transfer(access_cap, ctx.sender());
    }

    /// Claim access to a free skill. No payment required.
    public fun claim_free_skill(
        skill: &SkillRecord,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(skill.price == 0, ESkillNotPaid);

        let access_cap = AccessCap {
            id: object::new(ctx),
            skill_id: object::id(skill),
            blob_id: skill.blob_id,
            purchased_at: clock.timestamp_ms(),
        };

        event::emit(FreeSkillClaimed {
            skill_id: object::id(skill),
            claimer: ctx.sender(),
            access_cap_id: object::id(&access_cap),
        });

        transfer::transfer(access_cap, ctx.sender());
    }

    /// Seal access policy: called by Seal key servers to verify decryption rights.
    ///
    /// The `id` parameter is BCS-encoded and contains the SkillRecord's object ID.
    /// For free skills, access is always granted.
    /// For paid skills, the caller must provide a valid AccessCap.
    entry fun seal_approve(
        id: vector<u8>,
        skill: &SkillRecord,
        access_cap: &AccessCap,
    ) {
        // Decode the skill ID from the BCS-encoded id
        let mut prepared = bcs::new(id);
        let skill_id_bytes = prepared.peel_address();
        let target_id = object::id_from_address(skill_id_bytes);

        // Verify the access cap matches the requested skill
        assert!(access_cap.skill_id == target_id, ENoAccess);
        // Verify the skill matches
        assert!(object::id(skill) == target_id, ENoAccess);
    }

    /// Seal access policy for free skills: no AccessCap needed.
    entry fun seal_approve_free(
        id: vector<u8>,
        skill: &SkillRecord,
    ) {
        // Verify this is actually a free skill
        assert!(skill.price == 0, ESkillNotPaid);

        // Decode and verify skill ID
        let mut prepared = bcs::new(id);
        let skill_id_bytes = prepared.peel_address();
        let target_id = object::id_from_address(skill_id_bytes);
        assert!(object::id(skill) == target_id, ENoAccess);
    }

    /// Seal access policy v2: does NOT parse the id against the SkillRecord object ID.
    /// The `id` parameter is passed through by the Seal key server and must match
    /// the inner ID used during encryption (e.g. the blob ID hex).
    /// This function only validates that the AccessCap is for the given skill.
    entry fun seal_approve_v2(
        _id: vector<u8>,
        skill: &SkillRecord,
        access_cap: &AccessCap,
    ) {
        assert!(access_cap.skill_id == object::id(skill), ENoAccess);
    }

    /// Seal access policy v2 for free skills.
    entry fun seal_approve_free_v2(
        _id: vector<u8>,
        skill: &SkillRecord,
    ) {
        assert!(skill.price == 0, ESkillNotPaid);
    }

    /// Update the blob reference after initial publish. Creator only.
    /// Enables a two-step publish flow: create SkillRecord first, then encrypt and upload.
    public fun update_blob(
        skill: &mut SkillRecord,
        new_blob_id: u256,
        is_encrypted: bool,
        ctx: &mut TxContext,
    ) {
        assert!(skill.creator == ctx.sender(), ENotCreator);
        skill.blob_id = new_blob_id;
        skill.is_encrypted = is_encrypted;
    }

    /// Update the price of a skill. Only the creator can do this.
    public fun update_price(
        skill: &mut SkillRecord,
        new_price: u64,
        ctx: &mut TxContext,
    ) {
        assert!(skill.creator == ctx.sender(), ENotCreator);

        let old_price = skill.price;
        skill.price = new_price;

        event::emit(PriceUpdated {
            skill_id: object::id(skill),
            old_price,
            new_price,
        });
    }

    // ====== View Functions ======

    public fun get_price(skill: &SkillRecord): u64 { skill.price }
    public fun get_blob_id(skill: &SkillRecord): u256 { skill.blob_id }
    public fun get_creator(skill: &SkillRecord): address { skill.creator }
    public fun is_free(skill: &SkillRecord): bool { skill.price == 0 }
    public fun is_encrypted(skill: &SkillRecord): bool { skill.is_encrypted }
    public fun get_total_sales(skill: &SkillRecord): u64 { skill.total_sales }
    public fun get_total_revenue(skill: &SkillRecord): u64 { skill.total_revenue }

    public fun get_access_skill_id(cap: &AccessCap): ID { cap.skill_id }
    public fun get_access_blob_id(cap: &AccessCap): u256 { cap.blob_id }

    // ====== Tests ======

    #[test_only]
    use sui::test_scenario::{Self as ts, Scenario};
    #[test_only]
    use sui::clock;

    #[test_only]
    const CREATOR: address = @0xCAFE;
    #[test_only]
    const BUYER: address = @0xBEEF;
    #[test_only]
    const OTHER: address = @0xDEAD;
    #[test_only]
    const BLOB_ID: u256 = 123456789;
    #[test_only]
    const PRICE: u64 = 1_000_000_000;

    #[test_only]
    fun publish_free(scenario: &mut Scenario) {
        ts::next_tx(scenario, CREATOR);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        publish_skill(BLOB_ID, b"Test", b"Desc", 0, b"sdk", b"testnet", b"0xabc", false, &clock, ts::ctx(scenario));
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    fun publish_paid(scenario: &mut Scenario) {
        ts::next_tx(scenario, CREATOR);
        let clock = clock::create_for_testing(ts::ctx(scenario));
        publish_skill(BLOB_ID, b"Test", b"Desc", PRICE, b"sdk", b"testnet", b"0xabc", true, &clock, ts::ctx(scenario));
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    fun encode_skill_id(skill: &SkillRecord): vector<u8> {
        std::bcs::to_bytes(&object::id_to_address(&object::id(skill)))
    }

    // ---- publish_skill ----

    #[test]
    fun test_publish_free_skill() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, CREATOR);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(skill.price == 0);
        assert!(skill.blob_id == BLOB_ID);
        assert!(skill.creator == CREATOR);
        assert!(skill.is_encrypted == false);
        assert!(skill.total_sales == 0);
        assert!(skill.total_revenue == 0);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    fun test_publish_paid_encrypted_skill() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, CREATOR);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(skill.price == PRICE);
        assert!(skill.blob_id == BLOB_ID);
        assert!(skill.creator == CREATOR);
        assert!(skill.is_encrypted == true);
        assert!(skill.total_sales == 0);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- purchase_skill ----

    #[test]
    fun test_purchase_exact_payment() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        assert!(skill.total_sales == 1);
        assert!(skill.total_revenue == PRICE);
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Verify buyer got AccessCap
        ts::next_tx(&mut scenario, BUYER);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(cap.blob_id == BLOB_ID);
        assert!(cap.skill_id == object::id(&skill));
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        // Verify creator got payment
        ts::next_tx(&mut scenario, CREATOR);
        let received = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&received) == PRICE);
        ts::return_to_sender(&scenario, received);

        ts::end(scenario);
    }

    #[test]
    fun test_purchase_overpayment_returns_change() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        let overpay = PRICE * 3;
        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(overpay, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Buyer should get AccessCap + change
        ts::next_tx(&mut scenario, BUYER);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let change = ts::take_from_sender<Coin<SUI>>(&scenario);
        assert!(coin::value(&change) == overpay - PRICE);
        ts::return_to_sender(&scenario, cap);
        ts::return_to_sender(&scenario, change);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = EInsufficientPayment)]
    fun test_purchase_insufficient_payment_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE / 2, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ESkillIsFree)]
    fun test_purchase_free_skill_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        ts::end(scenario);
    }

    #[test]
    fun test_multiple_purchases_accumulate_stats() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        // First purchase
        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Second purchase by different user
        ts::next_tx(&mut scenario, OTHER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        assert!(skill.total_sales == 2);
        assert!(skill.total_revenue == PRICE * 2);
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        ts::end(scenario);
    }

    // ---- claim_free_skill ----

    #[test]
    fun test_claim_free_skill() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        claim_free_skill(&skill, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Verify AccessCap
        ts::next_tx(&mut scenario, BUYER);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(cap.blob_id == BLOB_ID);
        assert!(cap.skill_id == object::id(&skill));
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    fun test_multiple_users_claim_free_skill() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        claim_free_skill(&skill, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        ts::next_tx(&mut scenario, OTHER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        claim_free_skill(&skill, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Both should have AccessCap
        ts::next_tx(&mut scenario, BUYER);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        ts::return_to_sender(&scenario, cap);
        ts::next_tx(&mut scenario, OTHER);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        ts::return_to_sender(&scenario, cap);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ESkillNotPaid)]
    fun test_claim_paid_skill_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        claim_free_skill(&skill, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        ts::end(scenario);
    }

    // ---- seal_approve ----

    #[test]
    fun test_seal_approve_valid_access() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        // Purchase first
        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // seal_approve should succeed
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let id_bytes = encode_skill_id(&skill);
        seal_approve(id_bytes, &skill, &cap);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENoAccess)]
    fun test_seal_approve_wrong_id_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // seal_approve with wrong ID
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let wrong_id = std::bcs::to_bytes(&@0x0);
        seal_approve(wrong_id, &skill, &cap);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- seal_approve_free ----

    #[test]
    fun test_seal_approve_free_valid() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let id_bytes = encode_skill_id(&skill);
        seal_approve_free(id_bytes, &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ESkillNotPaid)]
    fun test_seal_approve_free_on_paid_skill_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let id_bytes = encode_skill_id(&skill);
        seal_approve_free(id_bytes, &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENoAccess)]
    fun test_seal_approve_free_wrong_id_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let wrong_id = std::bcs::to_bytes(&@0x0);
        seal_approve_free(wrong_id, &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- seal_approve_v2 ----

    #[test]
    fun test_seal_approve_v2_valid_access() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // seal_approve_v2 should succeed with ANY id bytes
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        seal_approve_v2(b"arbitrary_blob_id_bytes", &skill, &cap);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    fun test_seal_approve_free_v2_valid() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        seal_approve_free_v2(b"arbitrary_bytes", &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ESkillNotPaid)]
    fun test_seal_approve_free_v2_on_paid_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        seal_approve_free_v2(b"any", &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- update_blob ----

    #[test]
    fun test_update_blob_by_creator() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, CREATOR);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(skill.blob_id == BLOB_ID);
        update_blob(&mut skill, 999, true, ts::ctx(&mut scenario));
        assert!(skill.blob_id == 999);
        assert!(skill.is_encrypted == true);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotCreator)]
    fun test_update_blob_by_non_creator_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, OTHER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        update_blob(&mut skill, 999, false, ts::ctx(&mut scenario));
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- update_price ----

    #[test]
    fun test_update_price_by_creator() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, CREATOR);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(skill.price == PRICE);
        update_price(&mut skill, 2_000_000_000, ts::ctx(&mut scenario));
        assert!(skill.price == 2_000_000_000);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    fun test_update_price_to_zero_makes_free() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, CREATOR);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        assert!(skill.price > 0);
        update_price(&mut skill, 0, ts::ctx(&mut scenario));
        assert!(skill.price == 0);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotCreator)]
    fun test_update_price_by_non_creator_aborts() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, OTHER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        update_price(&mut skill, 0, ts::ctx(&mut scenario));
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = ENotCreator)]
    fun test_buyer_cannot_update_price() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        update_price(&mut skill, 500_000_000, ts::ctx(&mut scenario));
        ts::return_shared(skill);

        ts::end(scenario);
    }

    // ---- End-to-end flows ----

    #[test]
    fun test_full_paid_flow() {
        let mut scenario = ts::begin(CREATOR);
        publish_paid(&mut scenario);

        // Purchase
        ts::next_tx(&mut scenario, BUYER);
        let mut skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        let payment = coin::mint_for_testing<SUI>(PRICE, ts::ctx(&mut scenario));
        purchase_skill(&mut skill, payment, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Seal approve
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let cap = ts::take_from_sender<AccessCap>(&scenario);
        let id_bytes = encode_skill_id(&skill);
        seal_approve(id_bytes, &skill, &cap);
        assert!(cap.skill_id == object::id(&skill));
        assert!(cap.blob_id == skill.blob_id);
        assert!(skill.total_sales == 1);
        assert!(skill.total_revenue == PRICE);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(skill);

        ts::end(scenario);
    }

    #[test]
    fun test_full_free_flow() {
        let mut scenario = ts::begin(CREATOR);
        publish_free(&mut scenario);

        // Claim
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        claim_free_skill(&skill, &clock, ts::ctx(&mut scenario));
        ts::return_shared(skill);
        clock::destroy_for_testing(clock);

        // Seal approve free
        ts::next_tx(&mut scenario, BUYER);
        let skill = ts::take_shared<SkillRecord>(&scenario);
        let id_bytes = encode_skill_id(&skill);
        seal_approve_free(id_bytes, &skill);
        ts::return_shared(skill);

        ts::end(scenario);
    }
}
