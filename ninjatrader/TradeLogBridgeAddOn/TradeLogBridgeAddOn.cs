// TradeLog NinjaTrader 8 Desktop Add-On
// Read-only account/order/execution/position bridge.
// Official NinjaTrader Add-On Account events are used; no order methods are called.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;

namespace TradeLog.NinjaTraderBridge
{
    public class TradeLogBridgeAddOn : AddOnBase
    {
        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        private const string BridgeUrl = "http://127.0.0.1:4815/ingest";
        private bool subscribed;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name = "TradeLogBridgeAddOn";
                Description = "Read-only TradeLog bridge for NinjaTrader Desktop.";
            }
            else if (State == State.Active)
            {
                SubscribeAccounts();
                _ = PublishSnapshotAsync();
            }
            else if (State == State.Terminated)
            {
                UnsubscribeAccounts();
            }
        }

        private void SubscribeAccounts()
        {
            if (subscribed) return;
            lock (Account.All)
            {
                foreach (Account account in Account.All)
                {
                    account.ExecutionUpdate += OnExecutionUpdate;
                    account.OrderUpdate += OnOrderUpdate;
                    account.PositionUpdate += OnPositionUpdate;
                    account.AccountItemUpdate += OnAccountItemUpdate;
                }
            }
            Account.AccountStatusUpdate += OnAccountStatusUpdate;
            subscribed = true;
        }

        private void UnsubscribeAccounts()
        {
            if (!subscribed) return;
            lock (Account.All)
            {
                foreach (Account account in Account.All)
                {
                    account.ExecutionUpdate -= OnExecutionUpdate;
                    account.OrderUpdate -= OnOrderUpdate;
                    account.PositionUpdate -= OnPositionUpdate;
                    account.AccountItemUpdate -= OnAccountItemUpdate;
                }
            }
            Account.AccountStatusUpdate -= OnAccountStatusUpdate;
            subscribed = false;
        }

        private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
        {
            if (e?.Execution == null) return;
            var account = e.Execution.Account;
            PublishEvent("trade", new
            {
                accountId = account?.Name,
                executionId = e.Execution.ExecutionId,
                orderId = e.Execution.Order?.OrderId,
                symbol = e.Execution.Instrument?.FullName,
                side = e.Execution.MarketPosition.ToString(),
                action = e.Execution.Order?.OrderAction.ToString(),
                quantity = e.Quantity,
                price = e.Price,
                time = e.Execution.Time.ToString("o")
            });
        }

        private void OnOrderUpdate(object sender, OrderEventArgs e)
        {
            if (e?.Order == null) return;
            PublishEvent("order", new
            {
                accountId = e.Order.Account?.Name,
                orderId = e.Order.OrderId,
                name = e.Order.Name,
                state = e.Order.OrderState.ToString(),
                symbol = e.Order.Instrument?.FullName,
                quantity = e.Quantity,
                averageFillPrice = e.AverageFillPrice
            });
        }

        private void OnPositionUpdate(object sender, PositionEventArgs e)
        {
            if (e?.Position == null) return;
            PublishEvent("position", new
            {
                accountId = e.Position.Account?.Name,
                symbol = e.Position.Instrument?.FullName,
                marketPosition = e.Position.MarketPosition.ToString(),
                quantity = e.Position.Quantity,
                averagePrice = e.Position.AveragePrice
            });
        }

        private void OnAccountItemUpdate(object sender, AccountItemEventArgs e)
        {
            if (e?.Account == null) return;
            PublishEvent("account", new
            {
                accountId = e.Account.Name,
                accountItem = e.AccountItem.ToString(),
                value = e.Value
            });
        }

        private void OnAccountStatusUpdate(object sender, AccountStatusEventArgs e)
        {
            if (e?.Account == null) return;
            PublishEvent("account", new { accountId = e.Account.Name, status = e.Status.ToString() });
        }

        private void PublishEvent(string type, object payload)
        {
            _ = PostAsync(new
            {
                event = new
                {
                    eventId = $"nt8:{type}:{Guid.NewGuid():N}",
                    connectorId = "apex-ninjatrader",
                    type,
                    timestamp = DateTime.UtcNow.ToString("o"),
                    payload
                }
            });
        }

        private async Task PublishSnapshotAsync()
        {
            var accounts = new List<object>();
            var orders = new List<object>();
            var fills = new List<object>();
            var positions = new List<object>();

            lock (Account.All)
            {
                foreach (Account account in Account.All)
                {
                    accounts.Add(new { id = account.Name, name = account.Name, connection = account.Connection?.Options?.Name });
                    lock (account.Orders)
                        orders.AddRange(account.Orders.Select(o => new { accountId = account.Name, orderId = o.OrderId, name = o.Name, state = o.OrderState.ToString(), symbol = o.Instrument?.FullName, quantity = o.Quantity, averageFillPrice = o.AverageFillPrice }));
                    lock (account.Executions)
                        fills.AddRange(account.Executions.Select(x => new { accountId = account.Name, executionId = x.ExecutionId, orderId = x.Order?.OrderId, action = x.Order?.OrderAction.ToString(), symbol = x.Instrument?.FullName, quantity = x.Quantity, price = x.Price, time = x.Time.ToString("o") }));
                    lock (account.Positions)
                        positions.AddRange(account.Positions.Select(p => new { accountId = account.Name, symbol = p.Instrument?.FullName, marketPosition = p.MarketPosition.ToString(), quantity = p.Quantity, averagePrice = p.AveragePrice }));
                }
            }

            await PostAsync(new { snapshot = new { accounts, orders, fills, positions } }).ConfigureAwait(false);
        }

        private static async Task PostAsync(object payload)
        {
            try
            {
                var json = JsonConvert.SerializeObject(payload);
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                await Http.PostAsync(BridgeUrl, content).ConfigureAwait(false);
            }
            catch
            {
                // The local bridge may be offline; NinjaTrader trading must continue unaffected.
            }
        }
    }
}
