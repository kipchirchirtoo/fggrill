import { pool } from '../config/pg';
import { logger } from '../utils/logger';
import notificationService from './notification.service';

interface VendorRating {
  id: number;
  vendor_id: number;
  category: string;
  score: number;
  comment?: string;
  created_by: string;
  created_at: Date;
}

interface VendorDelivery {
  id: number;
  vendor_id: number;
  purchase_order_id: number;
  delivery_date: Date;
  expected_date: Date;
  status: string;
  days_delayed?: number;
  complete: boolean;
  quality_issues: boolean;
  issues_description?: string;
}

interface VendorMetric {
  id: number;
  name: string;
  description: string;
  weight: number;
  calculation_method: string;
}

/**
 * Vendor Performance Service
 * 
 * Tracks and evaluates vendor performance metrics including:
 * - On-time delivery
 * - Price competitiveness
 * - Quality metrics
 * - Responsiveness
 * - Contract compliance
 */
class VendorPerformanceService {
  private db;
  // Define vendor metrics and weights
  private metrics: VendorMetric[] = [
    {
      id: 1,
      name: 'on_time_delivery',
      description: 'Percentage of deliveries that arrived on time',
      weight: 25,
      calculation_method: 'percentage'
    },
    {
      id: 2,
      name: 'quality',
      description: 'Quality of delivered goods',
      weight: 25,
      calculation_method: 'rating'
    },
    {
      id: 3,
      name: 'price_competitiveness',
      description: 'Price competitiveness compared to market averages',
      weight: 20,
      calculation_method: 'index'
    },
    {
      id: 4,
      name: 'responsiveness',
      description: 'Responsiveness to inquiries and issues',
      weight: 15,
      calculation_method: 'rating'
    },
    {
      id: 5,
      name: 'contract_compliance',
      description: 'Compliance with contract terms',
      weight: 15,
      calculation_method: 'percentage'
    }
  ];
  
  constructor() {
    this.db = pool;
  }
  
  /**
   * Get all vendors with their performance scores
   */
  async getAllVendorPerformance(): Promise<any> {
    try {
      logger.info('Fetching all vendor performance data');
      
      // Get vendor data with performance metrics
      const query = `
        SELECT 
          v.id,
          v.name,
          v.contact_person,
          v.contact_email,
          v.contact_phone,
          v.category,
          v.active,
          COALESCE(vp.overall_score, 0) as overall_score,
          COALESCE(vp.on_time_delivery_score, 0) as on_time_delivery_score,
          COALESCE(vp.quality_score, 0) as quality_score,
          COALESCE(vp.price_score, 0) as price_score,
          COALESCE(vp.responsiveness_score, 0) as responsiveness_score,
          COALESCE(vp.compliance_score, 0) as compliance_score,
          COALESCE(vp.last_updated, NOW()) as last_updated
        FROM 
          vendors v
        LEFT JOIN 
          vendor_performance vp ON v.id = vp.vendor_id
        ORDER BY 
          overall_score DESC
      `;
      
      const { rows } = await this.db.query(query);
      
      return {
        success: true,
        data: rows
      };
    } catch (error) {
      logger.error('Error fetching vendor performance:', error);
      return {
        success: false,
        message: 'Failed to fetch vendor performance data',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get detailed performance for a specific vendor
   * @param vendorId Vendor ID
   */
  async getVendorPerformanceDetails(vendorId: number): Promise<any> {
    try {
      logger.info(`Fetching detailed performance for vendor ${vendorId}`);
      
      // Get vendor data
      const vendorQuery = `
        SELECT 
          v.id,
          v.name,
          v.contact_person,
          v.contact_email,
          v.contact_phone,
          v.category,
          v.active,
          v.address,
          v.registration_number,
          v.tax_id,
          v.website,
          v.date_onboarded,
          COALESCE(vp.overall_score, 0) as overall_score,
          COALESCE(vp.on_time_delivery_score, 0) as on_time_delivery_score,
          COALESCE(vp.quality_score, 0) as quality_score,
          COALESCE(vp.price_score, 0) as price_score,
          COALESCE(vp.responsiveness_score, 0) as responsiveness_score,
          COALESCE(vp.compliance_score, 0) as compliance_score,
          COALESCE(vp.last_updated, NOW()) as last_updated
        FROM 
          vendors v
        LEFT JOIN 
          vendor_performance vp ON v.id = vp.vendor_id
        WHERE 
          v.id = $1
      `;
      
      const { rows: vendorData } = await this.db.query(vendorQuery, [vendorId]);
      
      if (!vendorData.length) {
        return {
          success: false,
          message: 'Vendor not found'
        };
      }
      
      // Get recent deliveries
      const deliveriesQuery = `
        SELECT 
          vd.id,
          vd.purchase_order_id,
          vd.delivery_date,
          vd.expected_date,
          vd.status,
          vd.days_delayed,
          vd.complete,
          vd.quality_issues,
          vd.issues_description,
          po.order_number,
          po.order_date,
          po.total_amount
        FROM 
          vendor_deliveries vd
        JOIN
          purchase_orders po ON vd.purchase_order_id = po.id
        WHERE 
          po.vendor_id = $1
        ORDER BY 
          vd.delivery_date DESC
        LIMIT 10
      `;
      
      const { rows: deliveries } = await this.db.query(deliveriesQuery, [vendorId]);
      
      // Get recent ratings
      const ratingsQuery = `
        SELECT 
          vr.id,
          vr.category,
          vr.score,
          vr.comment,
          vr.created_at,
          u.name as rated_by
        FROM 
          vendor_ratings vr
        JOIN
          users u ON vr.created_by = u.id
        WHERE 
          vr.vendor_id = $1
        ORDER BY 
          vr.created_at DESC
        LIMIT 10
      `;
      
      const { rows: ratings } = await this.db.query(ratingsQuery, [vendorId]);
      
      // Get price comparison
      const priceQuery = `
        SELECT 
          i.name as item_name,
          poi.unit_price as vendor_price,
          (
            SELECT AVG(p2.unit_price)
            FROM purchase_order_items p2
            JOIN purchase_orders po2 ON p2.purchase_order_id = po2.id
            WHERE p2.item_id = poi.item_id
            AND po2.vendor_id != $1
          ) as avg_market_price,
          i.category as item_category
        FROM 
          purchase_order_items poi
        JOIN
          purchase_orders po ON poi.purchase_order_id = po.id
        JOIN
          inventory_items i ON poi.item_id = i.id
        WHERE 
          po.vendor_id = $1
        GROUP BY
          i.name, poi.unit_price, i.category, poi.item_id
        ORDER BY
          i.name
        LIMIT 15
      `;
      
      const { rows: priceComparison } = await this.db.query(priceQuery, [vendorId]);
      
      // Calculate performance trends over time
      const trendsQuery = `
        SELECT 
          TO_CHAR(DATE_TRUNC('month', vd.delivery_date), 'YYYY-MM') as month,
          AVG(
            CASE 
              WHEN vd.days_delayed = 0 THEN 100
              WHEN vd.days_delayed <= 1 THEN 80
              WHEN vd.days_delayed <= 3 THEN 60
              WHEN vd.days_delayed <= 7 THEN 40
              ELSE 20
            END
          ) as on_time_score,
          AVG(
            CASE 
              WHEN vd.quality_issues = false THEN 100
              ELSE 60
            END
          ) as quality_score,
          COUNT(vd.id) as deliveries_count
        FROM 
          vendor_deliveries vd
        JOIN
          purchase_orders po ON vd.purchase_order_id = po.id
        WHERE 
          po.vendor_id = $1
          AND vd.delivery_date >= NOW() - INTERVAL '12 months'
        GROUP BY 
          month
        ORDER BY 
          month ASC
      `;
      
      const { rows: trends } = await this.db.query(trendsQuery, [vendorId]);
      
      return {
        success: true,
        data: {
          vendor: vendorData[0],
          metrics: this.metrics,
          deliveries,
          ratings,
          price_comparison: priceComparison,
          trends
        }
      };
    } catch (error) {
      logger.error(`Error fetching vendor ${vendorId} performance details:`, error);
      return {
        success: false,
        message: 'Failed to fetch vendor performance details',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Record a new vendor delivery
   * @param delivery Delivery data
   */
  async recordDelivery(delivery: VendorDelivery): Promise<any> {
    try {
      logger.info(`Recording delivery for vendor ${delivery.vendor_id}, PO: ${delivery.purchase_order_id}`);
      
      // Calculate days delayed
      const expectedDate = new Date(delivery.expected_date);
      const deliveryDate = new Date(delivery.delivery_date);
      const daysDelayed = Math.max(0, Math.floor((deliveryDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Insert delivery record
      const insertQuery = `
        INSERT INTO vendor_deliveries (
          vendor_id, purchase_order_id, delivery_date, expected_date, 
          status, days_delayed, complete, quality_issues, issues_description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
      
      const values = [
        delivery.vendor_id,
        delivery.purchase_order_id,
        delivery.delivery_date,
        delivery.expected_date,
        delivery.status,
        daysDelayed,
        delivery.complete,
        delivery.quality_issues,
        delivery.issues_description
      ];
      
      const { rows } = await this.db.query(insertQuery, values);
      
      // Update vendor performance scores
      await this.updateVendorScores(delivery.vendor_id);
      
      return {
        success: true,
        data: {
          id: rows[0].id,
          vendor_id: delivery.vendor_id,
          days_delayed: daysDelayed,
          message: 'Delivery record created successfully'
        }
      };
    } catch (error) {
      logger.error(`Error recording vendor delivery:`, error);
      return {
        success: false,
        message: 'Failed to record vendor delivery',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Submit a rating for a vendor
   * @param rating Rating data
   */
  async submitRating(rating: VendorRating): Promise<any> {
    try {
      logger.info(`Submitting ${rating.category} rating for vendor ${rating.vendor_id}`);
      
      // Insert rating
      const insertQuery = `
        INSERT INTO vendor_ratings (
          vendor_id, category, score, comment, created_by, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;
      
      const values = [
        rating.vendor_id,
        rating.category,
        rating.score,
        rating.comment || '',
        rating.created_by
      ];
      
      const { rows } = await this.db.query(insertQuery, values);
      
      // Update vendor performance scores
      await this.updateVendorScores(rating.vendor_id);
      
      return {
        success: true,
        data: {
          id: rows[0].id,
          message: 'Vendor rating submitted successfully'
        }
      };
    } catch (error) {
      logger.error(`Error submitting vendor rating:`, error);
      return {
        success: false,
        message: 'Failed to submit vendor rating',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Update all performance scores for a vendor
   * @param vendorId Vendor ID
   */
  private async updateVendorScores(vendorId: number): Promise<void> {
    try {
      // Calculate on-time delivery score
      const otdQuery = `
        SELECT
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN days_delayed = 0 THEN 1 ELSE 0 END) as on_time,
          AVG(CASE 
            WHEN days_delayed = 0 THEN 100
            WHEN days_delayed <= 1 THEN 80
            WHEN days_delayed <= 3 THEN 60
            WHEN days_delayed <= 7 THEN 40
            ELSE 20
          END) as score
        FROM
          vendor_deliveries vd
        JOIN
          purchase_orders po ON vd.purchase_order_id = po.id
        WHERE
          po.vendor_id = $1
          AND vd.delivery_date >= NOW() - INTERVAL '12 months'
      `;
      
      const { rows: otdData } = await this.db.query(otdQuery, [vendorId]);
      const onTimeDeliveryScore = otdData[0].score || 0;
      
      // Calculate quality score
      const qualityQuery = `
        SELECT
          AVG(CASE 
            WHEN quality_issues = false THEN 100
            ELSE 50
          END) as product_quality,
          AVG(score) as rating_quality
        FROM
          vendor_deliveries vd
        JOIN
          purchase_orders po ON vd.purchase_order_id = po.id
        LEFT JOIN
          vendor_ratings vr ON vr.vendor_id = po.vendor_id AND vr.category = 'quality'
        WHERE
          po.vendor_id = $1
          AND vd.delivery_date >= NOW() - INTERVAL '12 months'
      `;
      
      const { rows: qualityData } = await this.db.query(qualityQuery, [vendorId]);
      const productQuality = qualityData[0].product_quality || 0;
      const ratingQuality = qualityData[0].rating_quality || 0;
      
      // Weight product quality (70%) and rating quality (30%)
      const qualityScore = (productQuality * 0.7) + (ratingQuality * 0.3);
      
      // Calculate price competitiveness score
      const priceQuery = `
        SELECT
          AVG(
            CASE
              WHEN market_avg = 0 THEN 50
              WHEN poi.unit_price <= market_avg THEN 100
              ELSE 100 - MIN(100, ((poi.unit_price / market_avg - 1) * 100))
            END
          ) as price_score
        FROM (
          SELECT 
            poi.unit_price,
            poi.item_id,
            (
              SELECT AVG(p2.unit_price)
              FROM purchase_order_items p2
              JOIN purchase_orders po2 ON p2.purchase_order_id = po2.id
              WHERE p2.item_id = poi.item_id
              AND po2.vendor_id != po.vendor_id
            ) as market_avg
          FROM 
            purchase_order_items poi
          JOIN
            purchase_orders po ON poi.purchase_order_id = po.id
          WHERE 
            po.vendor_id = $1
            AND po.order_date >= NOW() - INTERVAL '12 months'
        ) AS price_comparison
      `;
      
      const { rows: priceData } = await this.db.query(priceQuery, [vendorId]);
      const priceScore = priceData[0].price_score || 50;
      
      // Calculate responsiveness score
      const responsivenessQuery = `
        SELECT
          AVG(score) as score
        FROM
          vendor_ratings
        WHERE
          vendor_id = $1
          AND category = 'responsiveness'
          AND created_at >= NOW() - INTERVAL '12 months'
      `;
      
      const { rows: responsivenessData } = await this.db.query(responsivenessQuery, [vendorId]);
      const responsivenessScore = responsivenessData[0].score || 50;
      
      // Calculate contract compliance score
      const complianceQuery = `
        SELECT
          AVG(score) as score
        FROM
          vendor_ratings
        WHERE
          vendor_id = $1
          AND category = 'compliance'
          AND created_at >= NOW() - INTERVAL '12 months'
      `;
      
      const { rows: complianceData } = await this.db.query(complianceQuery, [vendorId]);
      const complianceScore = complianceData[0].score || 50;
      
      // Calculate overall score
      const otdWeight = this.metrics.find(m => m.name === 'on_time_delivery')?.weight || 25;
      const qualityWeight = this.metrics.find(m => m.name === 'quality')?.weight || 25;
      const priceWeight = this.metrics.find(m => m.name === 'price_competitiveness')?.weight || 20;
      const responsivenessWeight = this.metrics.find(m => m.name === 'responsiveness')?.weight || 15;
      const complianceWeight = this.metrics.find(m => m.name === 'contract_compliance')?.weight || 15;
      
      const overallScore = (
        (onTimeDeliveryScore * otdWeight / 100) +
        (qualityScore * qualityWeight / 100) +
        (priceScore * priceWeight / 100) +
        (responsivenessScore * responsivenessWeight / 100) +
        (complianceScore * complianceWeight / 100)
      );
      
      // Update vendor performance record
      const upsertQuery = `
        INSERT INTO vendor_performance (
          vendor_id, overall_score, on_time_delivery_score, quality_score,
          price_score, responsiveness_score, compliance_score, last_updated
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (vendor_id)
        DO UPDATE SET
          overall_score = $2,
          on_time_delivery_score = $3,
          quality_score = $4,
          price_score = $5,
          responsiveness_score = $6,
          compliance_score = $7,
          last_updated = NOW()
      `;
      
      await this.db.query(upsertQuery, [
        vendorId,
        overallScore,
        onTimeDeliveryScore,
        qualityScore,
        priceScore,
        responsivenessScore,
        complianceScore
      ]);
      
      logger.info(`Updated performance scores for vendor ${vendorId}`);
    } catch (error) {
      logger.error(`Error updating vendor scores for ${vendorId}:`, error);
    }
  }
  
  /**
   * Get vendor ranking and comparison
   */
  async getVendorRankings(category?: string): Promise<any> {
    try {
      logger.info(`Generating vendor rankings ${category ? `for category: ${category}` : ''}`);
      
      const query = `
        SELECT 
          v.id,
          v.name,
          v.category,
          COALESCE(vp.overall_score, 0) as overall_score,
          COALESCE(vp.on_time_delivery_score, 0) as on_time_delivery_score,
          COALESCE(vp.quality_score, 0) as quality_score,
          COALESCE(vp.price_score, 0) as price_score,
          COALESCE(vp.responsiveness_score, 0) as responsiveness_score,
          COALESCE(vp.compliance_score, 0) as compliance_score,
          RANK() OVER (ORDER BY COALESCE(vp.overall_score, 0) DESC) as overall_rank,
          RANK() OVER (ORDER BY COALESCE(vp.on_time_delivery_score, 0) DESC) as delivery_rank,
          RANK() OVER (ORDER BY COALESCE(vp.quality_score, 0) DESC) as quality_rank,
          RANK() OVER (ORDER BY COALESCE(vp.price_score, 0) DESC) as price_rank
        FROM 
          vendors v
        LEFT JOIN 
          vendor_performance vp ON v.id = vp.vendor_id
        WHERE 
          v.active = true
          ${category ? 'AND v.category = $1' : ''}
        ORDER BY 
          overall_score DESC
      `;
      
      const { rows } = await this.db.query(
        query, 
        category ? [category] : []
      );
      
      // Calculate category averages
      const categories = [...new Set(rows.map((v: any) => v.category))];
      
      const categoryStats = [];
      for (const cat of categories) {
        const vendorsInCategory = rows.filter((v: any) => v.category === cat);
        
        if (vendorsInCategory.length === 0) continue;
        
        const avgOverall = vendorsInCategory.reduce((sum, v: any) => sum + v.overall_score, 0) / vendorsInCategory.length;
        const avgDelivery = vendorsInCategory.reduce((sum, v: any) => sum + v.on_time_delivery_score, 0) / vendorsInCategory.length;
        const avgQuality = vendorsInCategory.reduce((sum, v: any) => sum + v.quality_score, 0) / vendorsInCategory.length;
        const avgPrice = vendorsInCategory.reduce((sum, v: any) => sum + v.price_score, 0) / vendorsInCategory.length;
        
        categoryStats.push({
          category: cat,
          vendor_count: vendorsInCategory.length,
          avg_overall_score: Math.round(avgOverall * 10) / 10,
          avg_delivery_score: Math.round(avgDelivery * 10) / 10,
          avg_quality_score: Math.round(avgQuality * 10) / 10,
          avg_price_score: Math.round(avgPrice * 10) / 10
        });
      }
      
      return {
        success: true,
        data: {
          vendors: rows,
          category_stats: categoryStats,
          metrics: this.metrics
        }
      };
    } catch (error) {
      logger.error('Error generating vendor rankings:', error);
      return {
        success: false,
        message: 'Failed to generate vendor rankings',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Generate vendor performance report
   * @param vendorId Optional vendor ID
   * @param category Optional category
   */
  async generatePerformanceReport(vendorId?: number, category?: string): Promise<any> {
    try {
      logger.info(`Generating vendor performance report ${vendorId ? `for vendor ${vendorId}` : category ? `for category ${category}` : 'for all vendors'}`);
      
      let vendors = [];
      let trends = [];
      
      if (vendorId) {
        // Get data for specific vendor
        const vendorData = await this.getVendorPerformanceDetails(vendorId);
        if (!vendorData.success) {
          return vendorData;
        }
        
        vendors = [vendorData.data.vendor];
        trends = vendorData.data.trends;
      } else {
        // Get ranking data for multiple vendors
        const rankingData = await this.getVendorRankings(category);
        if (!rankingData.success) {
          return rankingData;
        }
        
        vendors = rankingData.data.vendors;
        
        // Get trend data for top vendors
        const topVendorIds = vendors.slice(0, 5).map((v: any) => v.id);
        
        const trendsQuery = `
          SELECT 
            v.id as vendor_id,
            v.name as vendor_name,
            TO_CHAR(DATE_TRUNC('month', vd.delivery_date), 'YYYY-MM') as month,
            AVG(
              CASE 
                WHEN vd.days_delayed = 0 THEN 100
                WHEN vd.days_delayed <= 1 THEN 80
                WHEN vd.days_delayed <= 3 THEN 60
                WHEN vd.days_delayed <= 7 THEN 40
                ELSE 20
              END
            ) as on_time_score
          FROM 
            vendor_deliveries vd
          JOIN
            purchase_orders po ON vd.purchase_order_id = po.id
          JOIN
            vendors v ON po.vendor_id = v.id
          WHERE 
            v.id = ANY($1)
            AND vd.delivery_date >= NOW() - INTERVAL '6 months'
          GROUP BY 
            v.id, v.name, month
          ORDER BY 
            v.id, month ASC
        `;
        
        const { rows: trendData } = await this.db.query(trendsQuery, [topVendorIds]);
        trends = trendData;
      }
      
      // Get recent issue reports
      const issuesQuery = `
        SELECT 
          v.name as vendor_name,
          v.category,
          vd.delivery_date,
          vd.issues_description,
          po.order_number,
          vd.quality_issues
        FROM 
          vendor_deliveries vd
        JOIN
          purchase_orders po ON vd.purchase_order_id = po.id
        JOIN
          vendors v ON po.vendor_id = v.id
        WHERE 
          (vd.quality_issues = true OR vd.days_delayed > 3)
          ${vendorId ? 'AND v.id = $1' : category ? 'AND v.category = $1' : ''}
        ORDER BY 
          vd.delivery_date DESC
        LIMIT 10
      `;
      
      const { rows: issues } = await this.db.query(
        issuesQuery,
        vendorId || category ? [vendorId || category] : []
      );
      
      // Get top performing vendors
      const topVendors = vendors.slice(0, 5);
      
      return {
        success: true,
        data: {
          vendors: vendors,
          top_vendors: topVendors,
          performance_trends: trends,
          recent_issues: issues,
          metrics: this.metrics,
          report_date: new Date().toISOString(),
          report_type: vendorId ? 'vendor_specific' : category ? 'category' : 'overall'
        }
      };
    } catch (error) {
      logger.error('Error generating vendor performance report:', error);
      return {
        success: false,
        message: 'Failed to generate vendor performance report',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export default new VendorPerformanceService();
