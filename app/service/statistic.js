const Service = require('./base')

class StatisticService extends Service {
  // 当前代理的统计数据
  async index (params = {}) {
    try {
      const { id, role } = this.user
      // 查询条件
      const queryCondition = {}
      const { startTime, endTime, userId } = params
      if (startTime || endTime) {
        queryCondition.createdAt = {}
        if (startTime) {
          queryCondition.createdAt.$gte = new Date(startTime)
        }
        if (endTime) {
          queryCondition.createdAt.$lte = new Date(endTime)
        }
      }
      if (role === 1) {
        return await this.admin(params)
      }
      let orderList = null
      if (role === 3 || role === 2) {
        queryCondition.owner = this.user.id
        orderList = await this.ctx.model.Order.find({...queryCondition}).populate('goods')
      }
      let type = role === 3 ? 0 : 3 // 特代 0 总代 3
      const data = await this.filterList(orderList, type)
      return data
    } catch (e) {
      console.log(e)
      this.ctx.throw(200, '查询失败')
    }
  }

  // 获取成员的统计信息
  async members (params = {}) {
    try {
      const { id, role } = this.user
      if (role !== 2) this.ctx.throw(200, '角色错误')
      // 查询条件
      const queryCondition = {}
      const { startTime, endTime, userId } = params
      if (startTime || endTime) {
        queryCondition.createdAt = {}
        if (startTime) {
          queryCondition.createdAt.$gte = new Date(startTime)
        }
        if (endTime) {
          queryCondition.createdAt.$lte = new Date(endTime)
        }
      }
      const curUserInfo = await this.ctx.model.User.findOne({_id: id}, 'members').populate({ path: 'members', select: '_id username' })
      const members = await Promise.all(curUserInfo.members.map(async (item) => {
        let newItem = item.toObject()
        const newCondition = queryCondition
        newCondition.owner = item._id
        const curStatistic = await this.ctx.model.Order.find({...newCondition}).populate('goods')
        newItem.statistic = this.filterList(curStatistic, 1)
        return newItem
      }))
      return members
    } catch (e) {
      console.log(e)
      this.ctx.throw(200, e.message || '获取失败')
    }
  }

  // 公司统计
  async admin (params = {}) {
    // 获取所有总代
    const zUserInfo = await this.ctx.model.User.find({ role: 2, status: 0 }, 'username')
    const adminStatistic = await Promise.all(zUserInfo.map(async item => {
      let newItem = item.toObject()
      const curStatistic = await this.ctx.model.Order.find({ ownerBoss: newItem._id }).populate('goods')
      newItem.statistic = this.filterList(curStatistic, 2)
      return newItem
    }))
    return adminStatistic
  }

  // 统计数据处理 type 0 计算零售价减特代价, 1 计算特代减总代, 2 计算总代减进价 3 零售价减总代价
  filterList (list, type = 0) {
    const { id, role } = this.user
    const orderCount = list.length // 订单数量
    let total = 0 // 订单总金额
    let totalProfit = 0 // 总利润
    let goodsCount = 0 // 商品总数量
    const goods = {}
    list.map(item => {
      total += item.total
      item.goods.map(gitem => {
        goodsCount += gitem.num
        if (!goods[gitem.skuId]) {
          goods[gitem.skuId] = { name: gitem.name, num: 0, total: 0 }
        }
        goods[gitem.skuId].num += gitem.num
        goods[gitem.skuId].total += gitem.total
        // te
        if (type === 0) {
          totalProfit = totalProfit + (gitem.lprice - gitem.tprice) * gitem.num
        }
        // zong see te
        if (type === 1) {
          totalProfit = totalProfit + (gitem.tprice - gitem.zprice) * gitem.num
        }
        // admin
        if (type === 2) {
          totalProfit = totalProfit + (gitem.zprice - gitem.bprice) * gitem.num
        }
        // zong
        if (type === 3) {
          totalProfit = totalProfit + (gitem.lprice - gitem.zprice) * gitem.num
        }
      })
    })
    let goodsArr = []
    for (let key in goods) {
      goodsArr.push(goods[key])
    }
    return { total, orderCount, goodsCount, totalProfit, goodsArr }
  }
}

module.exports = StatisticService
