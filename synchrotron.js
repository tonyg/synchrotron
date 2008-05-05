function Synchrotron(channel, exchange, options) {
    this.channel = channel;
    this.exchange = exchange;
    this.options = {
	routing_key: "",
	exchange_type: "fanout",
	should_declare_exchange: true,
    };
    Object.extend(this.options, options || {});
    this.queueName = null;
    this.consumerTag = null;

    this.initialise_queue();
}

Synchrotron.prototype.initialise_queue = function() {
    var self = this;

    if (self.consumerTag != null) {
	self.channel.basicCancel(self.consumerTag)
	.addCallback(function () {
			 self.consumerTag = null;
			 maybe_delete_queue();
		     });
    } else {
	maybe_delete_queue();
    }

    function maybe_delete_queue() {
	log("maybe_delete_queue");
	if (self.queueName != null) {
	    self.channel.queueDelete(self.queueName)
	    .addCallback(function () {
			     self.queueName = null;
			     maybe_declare_exchange();
			 });
	} else {
	    maybe_declare_exchange();
	}
    }
    function maybe_declare_exchange() {
	log("maybe_declare_exchange");
	if (self.options.should_declare_exchange) {
	    self.channel.exchangeDeclare(self.exchange, self.options.exchange_type)
	    .addCallback(declare_queue);
	} else {
	    declare_queue();
	}
    }
    function declare_queue() {
	log("declare_queue");
	self.channel.queueDeclare()
	.addCallback(on_queue_declared);
    }
    function on_queue_declared(queueName) {
	log({on_queue_declared: queueName});
	self.queueName = queueName;
	self.channel.queueBind(self.queueName, self.exchange, self.options.routing_key)
	.addCallback(on_queue_bound);
    }
    function on_queue_bound() {
	log("on_queue_bound");
	self.channel.basicConsume(self.queueName,
				  {
				      consumeOk: function(tag) {
					  self.consumerTag = tag;
				      },
				      deliver: function(delivery) {
					  self.handleDelivery(delivery);
				      }
				  })
	.addCallback(on_consumer_setup_complete);
    }
    function on_consumer_setup_complete() {
	log({on_consumer_setup_complete: self.consumerTag});
    }
}

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
