// Smart Automation Service for Instagram DM Tool
const db = require("./db");

class AutomationService {
  // ============================================
  // SENTIMENT ANALYSIS & MESSAGE PROCESSING
  // ============================================

  static analyzeMessage(contactId, messageText) {
    try {
      // Enhanced keyword-based sentiment analysis
      const analysis = this.performSentimentAnalysis(messageText);

      // Store analysis in database
      const stmt = db.prepare(`
        INSERT INTO conversation_analysis 
        (contact_id, message_text, sentiment, intent, confidence_score, keywords)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactId,
        messageText,
        analysis.sentiment,
        analysis.intent,
        analysis.confidence,
        JSON.stringify(analysis.keywords)
      );

      // Update lead score based on this interaction
      this.updateLeadScore(contactId);

      return {
        id: result.lastInsertRowid,
        ...analysis,
      };
    } catch (error) {
      console.error("Error analyzing message:", error);
      throw error;
    }
  }

  static performSentimentAnalysis(messageText) {
    const lowerMessage = messageText.toLowerCase();

    // Keyword categories
    const keywords = {
      positive: [
        "yes",
        "interested",
        "tell me more",
        "sounds good",
        "great",
        "awesome",
        "love it",
      ],
      interested: [
        "when",
        "how much",
        "price",
        "cost",
        "schedule",
        "book",
        "call",
        "meeting",
      ],
      questions: ["what", "how", "when", "where", "why", "which", "who", "?"],
      negative: [
        "no",
        "not interested",
        "stop",
        "remove",
        "spam",
        "busy",
        "leave me alone",
      ],
      objections: [
        "expensive",
        "too much",
        "cant afford",
        "already have",
        "not now",
        "maybe later",
      ],
    };

    let sentiment = "neutral";
    let intent = "general";
    let confidence = 0.5;
    let detectedKeywords = [];

    // Check for keywords and determine sentiment/intent
    if (keywords.negative.some((keyword) => lowerMessage.includes(keyword))) {
      sentiment = "not_interested";
      intent = "rejection";
      confidence = 0.9;
      detectedKeywords = keywords.negative.filter((k) =>
        lowerMessage.includes(k)
      );
    } else if (
      keywords.objections.some((keyword) => lowerMessage.includes(keyword))
    ) {
      sentiment = "negative";
      intent = "objection";
      confidence = 0.8;
      detectedKeywords = keywords.objections.filter((k) =>
        lowerMessage.includes(k)
      );
    } else if (
      keywords.interested.some((keyword) => lowerMessage.includes(keyword))
    ) {
      sentiment = "interested";
      intent = "interest";
      confidence = 0.9;
      detectedKeywords = keywords.interested.filter((k) =>
        lowerMessage.includes(k)
      );
    } else if (
      keywords.positive.some((keyword) => lowerMessage.includes(keyword))
    ) {
      sentiment = "positive";
      intent = "positive_response";
      confidence = 0.8;
      detectedKeywords = keywords.positive.filter((k) =>
        lowerMessage.includes(k)
      );
    } else if (
      keywords.questions.some((keyword) => lowerMessage.includes(keyword))
    ) {
      sentiment = "neutral";
      intent = "question";
      confidence = 0.7;
      detectedKeywords = keywords.questions.filter((k) =>
        lowerMessage.includes(k)
      );
    }

    return {
      sentiment,
      intent,
      confidence,
      keywords: detectedKeywords,
    };
  }
  // ============================================
  // AUTOMATION RULES MANAGEMENT
  // ============================================

  static createAutomationRule(ruleData) {
    const stmt = db.prepare(`
      INSERT INTO automation_rules 
      (name, trigger_type, trigger_conditions, action_type, action_parameters, priority, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Map frontend field names to what we need
    const triggerConditions = {
      trigger_value: ruleData.trigger_value || "",
      conditions: ruleData.conditions || {},
    };

    const actionParameters = {
      response_template: ruleData.response_template || "",
    };

    return stmt.run(
      ruleData.name,
      ruleData.trigger_type,
      JSON.stringify(triggerConditions),
      "send_message", // Default action type
      JSON.stringify(actionParameters),
      ruleData.priority || 1,
      ruleData.is_active ? 1 : 0
    );
  }

  static getAutomationRules(activeOnly = true) {
    let query = "SELECT * FROM automation_rules";
    if (activeOnly) {
      query += " WHERE is_active = 1";
    }
    query += " ORDER BY priority DESC, created_at ASC";

    const stmt = db.prepare(query);
    const rules = stmt.all();
    return rules.map((rule) => ({
      ...rule,
      triggerConditions: JSON.parse(rule.trigger_conditions),
      actionData: JSON.parse(rule.action_parameters),
    }));
  }

  static toggleAutomationRule(ruleId, isActive) {
    const stmt = db.prepare(`
      UPDATE automation_rules 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    return stmt.run(isActive ? 1 : 0, ruleId);
  }

  static deleteAutomationRule(ruleId) {
    const stmt = db.prepare("DELETE FROM automation_rules WHERE id = ?");
    return stmt.run(ruleId);
  }

  // ============================================
  // RULE EVALUATION & EXECUTION
  // ============================================

  static getTriggeredRules(contactId, messageText, context = {}) {
    const rules = this.getAutomationRules(true);
    const triggeredRules = [];

    rules.forEach((rule) => {
      if (this.evaluateRuleConditions(rule, messageText, context)) {
        triggeredRules.push(rule);
      }
    });

    return triggeredRules;
  }

  static evaluateRuleConditions(rule, messageText, context) {
    const conditions = rule.triggerConditions;

    switch (rule.trigger_type) {
      case "keyword":
        return conditions.keywords.some((keyword) =>
          messageText.toLowerCase().includes(keyword.toLowerCase())
        );

      case "sentiment":
        const analysis = this.performSentimentAnalysis(messageText);
        return conditions.sentiments.includes(analysis.sentiment);

      case "no_response":
        // Check if enough time has passed since last message
        const lastMessageTime = context.lastMessageTime;
        const hoursThreshold = conditions.hoursWithoutResponse || 24;
        return (
          lastMessageTime &&
          Date.now() - new Date(lastMessageTime).getTime() >=
            hoursThreshold * 3600000
        );

      default:
        return false;
    }
  }

  static async executeAutomationRule(rule, contactId, context = {}) {
    try {
      let result = null;

      switch (rule.action_type) {
        case "send_message":
          result = await this.sendAutomatedMessage(
            contactId,
            rule.actionData.message
          );
          break;

        case "add_tag":
          result = await this.addContactTag(contactId, rule.actionData.tag);
          break;

        case "move_stage":
          result = await this.moveContactStage(
            contactId,
            rule.actionData.stage
          );
          break;

        case "send_sequence":
          result = await this.startFollowupSequence(
            contactId,
            rule.actionData.sequenceId
          );
          break;

        default:
          throw new Error(`Unknown action type: ${rule.action_type}`);
      }

      // Log execution
      this.logAutomationExecution(
        rule.id,
        null,
        contactId,
        "rule",
        context,
        rule.action_type,
        "success"
      );

      return result;
    } catch (error) {
      // Log failed execution
      this.logAutomationExecution(
        rule.id,
        null,
        contactId,
        "rule",
        context,
        rule.action_type,
        "failed",
        error.message
      );
      throw error;
    }
  }

  // ============================================
  // FOLLOW-UP SEQUENCES
  // ============================================

  static createFollowupSequence(sequenceData) {
    const stmt = db.prepare(`
      INSERT INTO automation_sequences 
      (name, description, trigger_event, steps)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      sequenceData.name,
      sequenceData.description || "",
      sequenceData.triggerEvent,
      JSON.stringify(sequenceData.steps)
    );
  }

  static getFollowupSequences(activeOnly = true) {
    let query = "SELECT * FROM automation_sequences";
    if (activeOnly) {
      query += " WHERE is_active = 1";
    }
    query += " ORDER BY created_at DESC";

    const stmt = db.prepare(query);
    const sequences = stmt.all();

    return sequences.map((seq) => ({
      ...seq,
      steps: JSON.parse(seq.steps),
    }));
  }

  static async startFollowupSequence(contactId, sequenceId) {
    // Implementation for starting a follow-up sequence
    // This would typically involve scheduling future messages
    const sequence = this.getFollowupSequences().find(
      (s) => s.id === sequenceId
    );
    if (!sequence) {
      throw new Error(`Sequence ${sequenceId} not found`);
    }

    // For now, just log that we started the sequence
    this.logAutomationExecution(
      null,
      sequenceId,
      contactId,
      "sequence_start",
      {},
      "start_sequence",
      "success"
    );

    return { success: true, message: `Started sequence: ${sequence.name}` };
  }

  // ============================================
  // LEAD SCORING
  // ============================================

  static updateLeadScore(contactId) {
    try {
      // Get contact information
      const contactStmt = db.prepare("SELECT * FROM crm_contacts WHERE id = ?");
      const contact = contactStmt.get(contactId);

      if (!contact) return null;

      // Get conversation history
      const conversationStmt = db.prepare(`
        SELECT * FROM conversation_analysis 
        WHERE contact_id = ? 
        ORDER BY created_at DESC
      `);
      const conversations = conversationStmt.all(contactId);

      // Calculate scores
      const scores = this.calculateLeadScores(contact, conversations);

      // Store/update lead score
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO lead_scores 
        (contact_id, engagement_score, response_quality_score, profile_quality_score, 
         total_score, conversion_probability, score_breakdown)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        contactId,
        scores.engagement,
        scores.responseQuality,
        scores.profileQuality,
        scores.total,
        scores.conversionProbability,
        JSON.stringify(scores.breakdown)
      );
    } catch (error) {
      console.error("Error updating lead score:", error);
      throw error;
    }
  }

  static calculateLeadScores(contact, conversations) {
    let engagementScore = 0;
    let responseQualityScore = 0;
    let profileQualityScore = 0;

    // Engagement Score (0-100)
    if (contact.responses_received > 0) {
      engagementScore = Math.min(contact.responses_received * 15, 100);
    }

    // Response Quality Score (0-100)
    if (conversations.length > 0) {
      const positiveResponses = conversations.filter(
        (c) => c.sentiment === "positive" || c.sentiment === "interested"
      ).length;
      const negativeResponses = conversations.filter(
        (c) => c.sentiment === "not_interested" || c.sentiment === "negative"
      ).length;

      responseQualityScore = Math.max(
        0,
        ((positiveResponses * 2 - negativeResponses) / conversations.length) *
          100
      );
    }

    // Profile Quality Score (0-100) - based on available profile data
    profileQualityScore = 50; // Base score
    if (contact.full_name) profileQualityScore += 10;
    if (contact.email) profileQualityScore += 20;
    if (contact.phone) profileQualityScore += 20;

    // Total Score
    const totalScore = Math.round(
      (engagementScore + responseQualityScore + profileQualityScore) / 3
    );

    // Conversion Probability (0-1)
    const conversionProbability = Math.min(1, totalScore / 100);

    return {
      engagement: Math.round(engagementScore),
      responseQuality: Math.round(responseQualityScore),
      profileQuality: Math.round(profileQualityScore),
      total: totalScore,
      conversionProbability: conversionProbability,
      breakdown: {
        engagement: engagementScore,
        responseQuality: responseQualityScore,
        profileQuality: profileQualityScore,
        conversationCount: conversations.length,
        positiveInteractions: conversations.filter(
          (c) => c.sentiment === "positive" || c.sentiment === "interested"
        ).length,
      },
    };
  }
  static getHighValueLeads(limit = 50) {
    const stmt = db.prepare(`
      SELECT 
        c.*,
        ls.engagement_score,
        ls.response_probability,
        ls.conversion_score,
        ls.last_activity,
        (ls.engagement_score + ls.conversion_score + ROUND(ls.response_probability * 100)) as total_score
      FROM crm_contacts c
      LEFT JOIN lead_scores ls ON c.username = ls.username
      WHERE ls.response_probability > 0.5
      ORDER BY ls.response_probability DESC, (ls.engagement_score + ls.conversion_score) DESC
      LIMIT ?
    `);

    return stmt.all(limit);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  static async sendAutomatedMessage(contactId, message) {
    // This would integrate with your DM sending system
    // For now, just simulate the action
    console.log(
      `Sending automated message to contact ${contactId}: ${message}`
    );

    // Update contact interaction
    const stmt = db.prepare(`
      INSERT INTO crm_interactions (contact_id, type, content)
      VALUES (?, 'dm_sent', ?)
    `);

    return stmt.run(contactId, message);
  }

  static async addContactTag(contactId, tag) {
    const contactStmt = db.prepare(
      "SELECT tags FROM crm_contacts WHERE id = ?"
    );
    const contact = contactStmt.get(contactId);

    if (contact) {
      const tags = JSON.parse(contact.tags || "[]");
      if (!tags.includes(tag)) {
        tags.push(tag);

        const updateStmt = db.prepare(`
          UPDATE crm_contacts 
          SET tags = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);

        return updateStmt.run(JSON.stringify(tags), contactId);
      }
    }

    return null;
  }

  static async moveContactStage(contactId, stage) {
    const stmt = db.prepare(`
      UPDATE crm_contacts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    return stmt.run(stage, contactId);
  }

  static logAutomationExecution(
    ruleId,
    sequenceId,
    contactId,
    executionType,
    triggerData,
    actionTaken,
    result,
    errorMessage = null
  ) {
    const stmt = db.prepare(`
      INSERT INTO automation_executions 
      (rule_id, sequence_id, contact_id, execution_type, trigger_data, action_taken, result, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      ruleId,
      sequenceId,
      contactId,
      executionType,
      JSON.stringify(triggerData),
      actionTaken,
      result,
      errorMessage
    );
  }

  // Simplified method for recording automation rule executions
  static recordExecution(ruleId, contactUsername, executionData) {
    return this.logAutomationExecution(
      ruleId,
      null, // sequenceId
      contactUsername, // using username as contactId for now
      'rule',
      executionData,
      'automated_response',
      executionData.status || 'success',
      executionData.error || null
    );
  }

  // ============================================
  // ANALYTICS & METRICS
  // ============================================

  static getAutomationMetrics(timeframe = "30d") {
    const daysBack = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN execution_status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
        COUNT(DISTINCT contact_username) as unique_contacts_reached,
        trigger_event,
        DATE(executed_at) as execution_date
      FROM automation_executions
      WHERE executed_at >= ?
      GROUP BY trigger_event, DATE(executed_at)
      ORDER BY execution_date DESC
    `);

    return stmt.all(startDate.toISOString());
  }
  static getSequencePerformance() {
    const stmt = db.prepare(`
      SELECT 
        s.*,
        COUNT(ae.id) as total_executions,
        SUM(CASE WHEN ae.execution_status = 'completed' THEN 1 ELSE 0 END) as successful_executions
      FROM automation_sequences s
      LEFT JOIN automation_executions ae ON s.id = ae.sequence_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    return stmt.all();
  }
  static getRulePerformance() {
    const stmt = db.prepare(`
      SELECT 
        r.*,
        COUNT(ae.id) as total_executions,
        SUM(CASE WHEN ae.execution_status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
        ROUND(AVG(CASE WHEN ae.execution_status = 'completed' THEN 100.0 ELSE 0.0 END), 2) as success_rate
      FROM automation_rules r
      LEFT JOIN automation_executions ae ON r.id = ae.rule_id
      GROUP BY r.id
      ORDER BY success_rate DESC, total_executions DESC
    `);

    return stmt.all();
  }
}

module.exports = AutomationService;
