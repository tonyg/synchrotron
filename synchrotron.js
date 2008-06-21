function Synchrotron(channel, exchange, options) {
    this.channel = channel;
    this.exchange = exchange;
    this.options = {
        routing_key: "",
        exchange_type: "fanout",
        should_declare_exchange: true
    };
    Object.extend(this.options, options || {});
    this.queueName = null;
    this.consumerTag = null;

    this.initialise_queue();
}

Synchrotron.prototype.initialise_queue = function() {
    var $elf = this;

    if ($elf.consumerTag !== null) {
        $elf.channel.basicCancel($elf.consumerTag)
        .addCallback(function () {
                         $elf.consumerTag = null;
                         maybe_delete_queue();
                     });
    } else {
        maybe_delete_queue();
    }

    function maybe_delete_queue() {
        log("maybe_delete_queue");
        if ($elf.queueName !== null) {
            $elf.channel.queueDelete($elf.queueName)
            .addCallback(function () {
                             $elf.queueName = null;
                             maybe_declare_exchange();
                         });
        } else {
            maybe_declare_exchange();
        }
    }
    function maybe_declare_exchange() {
        log("maybe_declare_exchange");
        if ($elf.options.should_declare_exchange) {
            $elf.channel.exchangeDeclare($elf.exchange, $elf.options.exchange_type)
            .addCallback(declare_queue);
        } else {
            declare_queue();
        }
    }
    function declare_queue() {
        log("declare_queue");
        $elf.channel.queueDeclare()
        .addCallback(on_queue_declared);
    }
    function on_queue_declared(queueName) {
        log({on_queue_declared: queueName});
        $elf.queueName = queueName;
        $elf.channel.queueBind($elf.queueName, $elf.exchange, $elf.options.routing_key)
        .addCallback(on_queue_bound);
    }
    function on_queue_bound() {
        log("on_queue_bound");
        $elf.channel.basicConsume($elf.queueName,
                                  {
                                      consumeOk: function(tag) {
                                          $elf.consumerTag = tag;
                                      },
                                      deliver: function(delivery) {
                                          $elf.handleDelivery(delivery);
                                      }
                                  })
        .addCallback(on_consumer_setup_complete);
    }
    function on_consumer_setup_complete() {
        log({on_consumer_setup_complete: $elf.consumerTag});
    }
};

function log() {
    $A(arguments).each(function (arg) {
                           if (typeof(arg) == 'string') {
                               $("testOutput").appendChild(document.createTextNode(arg + "\n"));
                           } else {
                               $("testOutput").appendChild(document
                                                           .createTextNode(JSON.stringify(arg) +
                                                                           "\n"));
                           }
                       });
}
