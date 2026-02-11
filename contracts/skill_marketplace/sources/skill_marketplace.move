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

    const EInvalidPrice: u64 = 0;
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
    public entry fun publish_skill(
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
    public entry fun purchase_skill(
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
    public entry fun claim_free_skill(
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
        let target_id = object::id_from_address(skill_id_bytes.to_address());

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
        let target_id = object::id_from_address(skill_id_bytes.to_address());
        assert!(object::id(skill) == target_id, ENoAccess);
    }

    /// Update the price of a skill. Only the creator can do this.
    public entry fun update_price(
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
}
