# CascadeServe: Unlocking Model Cascades for Inference Serving

Ferdi Kossmann, Ziniu Wu, Alex Turk, Nesime Tatbul, Lei Cao, Samuel Madden  
2024  
arXiv: 2406.14424v1

## Abstract

Machine learning (ML) models are increasingly deployed to production, calling for efficient inference serving systems. Efficient inference serving is complicated by two challenges: (i) ML models incur high computational costs, and (ii) the request arrival rates of practical applications have frequent, high, and sudden variations which make it hard to correctly provision hardware. Model cascades are positioned to tackle both of these challenges, as they (i) save work while maintaining accuracy, and (ii) expose a high-resolution trade-off between work and accuracy, allowing for fine-grained adjustments to request arrival rates. Despite their potential, model cascades haven’t been used inside an online serving system. This comes with its own set of challenges, including workload adaption, model replication onto hardware, inference scheduling, request batching, and more. In this work, we propose CascadeServe, which automates and optimizes end-to-end inference serving with cascades. CascadeServe operates in an offline and online phase. In the offline phase, the system pre-computes a *gear plan* that specifies how to serve inferences online. In the online phase, the gear plan allows the system to serve inferences while making near-optimal adaptations to the query load at negligible decision overheads. We find that CascadeServe saves 2-3$\times$ in cost across a wide spectrum of the latency-accuracy space when compared to state-of-the-art baselines on different workloads.

## 1 Introduction

The growing capabilities of machine learning (ML) models have prompted a rapid growth in their adoption for a variety of use cases. For example, Meta performs trillions of model inferences per day, and 70% of their ML energy consumption is for inference [61]. Given the growing scales of ML adoption, it is crucial to build efficient inference serving systems.

**Figure 1.** Per-sample processing times and accuracy of fine-tuned BERT models on the Sentiment-140 benchmark [21].

Inference serving systems need to optimize their service with regard to three metrics: (i) they need to serve predictions at low latency, (ii) they need to make predictions with high accuracy, and (iii) they need to incur low cost (i.e., use few hardware resources). Achieving satisfactory performance in terms of these metrics is difficult because of two challenges: (i) ML models incur high computational costs (e.g., Llama-2 70B takes $450ms$ to generate the first token on two V100 GPUs^1), and (ii) the request arrival rate in many applications has frequent, high, and sudden variations, which make it hard to optimally provision hardware [39, 71]. For example, Figure 1 (right) shows an excerpt of a request trace that is representative of inference serving [50]. Provisioning for peak workload leaves hardware resources idle most of the time, but under-provisioning leads to insufficient throughput during workload peaks.

We find that *model cascades* are positioned to naturally tackle both of these challenges. ML models generally posses a trade-off between runtime and accuracy, where some models are fast but inaccurate (e.g., Llama-7B) while others are slow but accurate (e.g., Llama-70B) [9, 30]. Prior work on model cascades [57] proposes a way to exploit this trade-off and deliver the accuracy of expensive models with significantly less computation. In a model cascade, each sample is first passed through a cheap model, after which the certainty of the model’s prediction is quantified. If the cheap model is certain about its prediction, the prediction is used as the final output. However, if the prediction certainty is below a defined threshold, the sample is forwarded to the next model in the cascade, which is usually more expensive and accurate. This allows cascades to predict most inputs with cheap models but predict “difficult” inputs with expensive models, simultaneously enabling high accuracy and low computational cost.

Figure 1 shows the accuracy and average processing time of fine-tuned BERT models [18] on a sentiment classification task [21]. Some model cascades can achieve the same accuracy as the largest model (BERT Base) while taking $3.8\times$ less time to process a sample on average. Furthermore, model cascades expose a high-resolution trade-off between processing time and accuracy. In this work, we leverage both properties to address the challenges imposed by inference serving.

First, we leverage the savings in processing time to reduce the hardware resources needed for serving. Second, we leverage the high-resolution work-accuracy trade-off to scale throughput by making fine-grained adjustments to the cascade. This avoids the dilemma of provisioning hardware for fluctuating workloads. Specifically, under light load, we use cascades that frequently invoke expensive models and achieve high accuracy; under heavy load, we switch to cascades that use cheaper models to achieve higher throughput. Degrading accuracy during high demand is a technique that is already deployed in production today [64].

Despite their advantages, model cascades have not been applied inside end-to-end serving systems and doing so incurs a set of unique challenges. First, the certainty thresholds of the cascade need to be dynamically adapted to changes in system load. For large changes, tuning the thresholds becomes insufficient, and the system needs to remove models from the cascades or add new ones. To do this, the system has to allocate models between available GPUs, accounting for the fact that loading models can take seconds. Moreover, the system needs to schedule inferences as several models in the cascade may contend for compute on the same GPU. Scheduling decisions must consider *batching* effects, which have a large impact on end-to-end performance: Delaying the inference of a model incurs waiting times but allows more samples to be propagated through the model as one batch, which increases throughput through better hardware utilization. Overall, optimally using cascades inside a serving system thus involves the optimization of many moving pieces, leading to an immense, exponential search space.

In this work, we propose CascadeServe to leverage the potential of cascades for inference serving. CascadeServe efficiently adapts cascades to the incoming workload, which involves making decisions at low overhead while facing an exponential search space. To achieve this, the system off-loads most of its decision making to an offline planning phase. During the offline phase, CascadeServe generates a *gear plan* that specifies how to serve inferences under varying system loads. Given this gear plan, online cascade adaption boils down to switching between gears, allowing CascadeServe to make near-optimal decisions at negligible overhead.

CascadeServe generates gear plans with respect to the user’s available hardware and a service-level objective (SLO). The SLO defines a constraint on either accuracy or latency. CascadeServe will fulfill the latency SLO while optimizing for accuracy or vice versa. To efficiently choose an optimal gear plan, we decompose the exponential decision space into several sub-decisions and propose a novel algorithm to jointly optimize these sub-decisions. In experiments, our algorithm can find near-optimal gear plans within a few minutes. In addition, CascadeServe develops an efficient online serving architecture that operate according to a gear plan.

We evaluate CascadeServe on workloads with fast and slow models and find that it consistently outperforms state-of-the-art systems. For most points in the latency-accuracy trade-off space, CascadeServe incurs 2-3$\times$ less cost than the best baseline in that regime. For a fixed number of GPUs, CascadeServe significantly beats baselines in terms of both, accuracy and latency.

In summary, our contributions are as follows:

$\bullet$ We propose an efficient inference serving system that operates in an offline preparation phase and an online serving phase. The system is the first end-to-end serving system that automatically optimizes its service through model cascades.

$\bullet$ We design a novel algorithm that generates a near-optimal *gear plan* in the offline phase. The gear plan describes how to serve inferences in the online phase, considering the user’s workload and Service-Level Objective, available hardware resources, and the offered load of the system.

$\bullet$ We evaluate the system’s performance on different workload traces and inference tasks.

## 2 Background

In this section, we first provide the background on model cascades, and then review prior work on model inferencing.

### 2.1 Model cascades

Most machine learning tasks inherently pose a trade-off between cost and accuracy [9, 30]. Developers usually train models with different architectures/sizes to explore this trade-off. For example, BERT [18], YOLO [47], and Llama [54] models are released in various sizes, where some are faster but less accurate, while others are slower but more accurate.

Previous work has proposed an elegant method to exploit this trade-off by combining models of different sizes into a *model cascade* [57]. First, a model cascade feeds a sample through a cheap model to obtain an initial prediction and an estimated certainty of this prediction. If the cheap model is certain, the prediction will likely be accurate and can be used as the final output. However, if the prediction certainty is below a defined threshold, the sample is forwarded to another model, which is typically more expensive and accurate. This conditional forwarding is repeated until the model prediction is certain or the last model in the cascade is reached.

The key insight behind model cascades is that most samples are “easy” to predict (e.g., far away from decision boundaries). For these samples, even a cheap model can deliver accurate predictions. The accuracy gain of more expensive models only comes from performing better on the “difficult” samples (e.g., samples that lie close to decision boundaries). By using cheap models for the “easy” inputs and expensive models for the few “difficult” inputs, model cascades can achieve high prediction accuracy at low average cost. Therefore, model cascades have been used to optimize various ML tasks, such as classification [37], regression [63], object detection [57], recommendation [46], or text generation [24].

### 2.2 Related work

#### Inference serving.

Inference serving systems provide an endpoint that users call to obtain predictions on input samples. We divide prior work on inference serving into two categories: works where users request inferences from a specific model and works where the serving system may choose which model or ensemble of models it uses to serve a request.

Clipper [16], Rafiki [58], HOLMES [26] and Cocktail [23] serve inferences through carefully designed bagging ensembles. Fundamentally, these systems assume that models in a bagging ensemble can be executed independently in parallel, whereas models in a cascade must execute sequentially. This characteristic of cascades imposes a unique set of challenges and requires different inference serving approaches, which we will explain in details later. INFaaS [48] and Model Switching [72] maintain a pool of models but do not use them in an ensemble fashion. They use a single model for each request but switch between different models depending on the system load. SuperServe [32] leverages weight-shared SuperNetworks [11] to adapt computational demand to the workload at reduced memory overhead. The Databricks model serving platform [3] allows users to split requests between models according to user-defined fractions.

Other works on inference serving assume that users request inferences from a specific model. Production systems with this functionality include SageMaker [1], TensorFlow Serving [6], TorchServe [7], AzureML [2], Triton [5], Databricks [4]. There also are academic works that propose serving systems that let users query different models which are hosted on shared hardware [71, 28, 39, 25, 62, 38, 70, 22]. BATCH allows for batched inference serving on serverless platforms [8]. Some works focus on how to share GPUs more efficiently among several tasks for inference serving [27, 68, 53, 43, 14].

In summary, the common difference that these works have to CascadeServe, is that they don’t leverage cascades to optimize inference serving.

**Model cascades.** Several works have identified cascading as a way to reduce computational demand while maintaining predictive performance. IDK cascades [59] search for cascades on the pareto frontier between compuational cost (i.e. floating point operations) and accuracy. Further works expand on this method [37, 44, 40]. UnfoldML [65] proposes 2-dimensional cascades and optimizes them for spatio-temporal cost and accuracy. Willump [35] automatically builds cascades for ML pipelines where the bottleneck is computing the inputs to the model. Since these works don’t consider end-to-end serving systems, they don’t address many aspects of leveraging cascades inside such systems (e.g. the allocation of hardware resources, request batching, etc.) To effectively leverage cascades inside a serving system, these factors need to be co-optimized with the cascades themselves. FrugalML [13] and FrugalGPT [12] optimize calls to serving endpoints. While they use cascading to optimize calls to APIs, they don’t aim to improve efficiency inside a serving system. Finally, many works have proposed the use of specific model cascades to optimize a particular prediction task. Noscope [29] and WEG [52] use cascades to accelerate searching through large videos to find objects. Stage [63] uses cascades for runtime estimation inside a database engine.

In summary, the common differences between these works and CascadeServe is, that these works don’t consider an end-to-end serving scenario and the aspects that are involved to leverage cascades in this context.

**ML pipeline serving.** Some works seek to optimize the inference of entire ML pipelines, where several different models may interact with each other to produce outputs (e.g. using Alexa might first involve speech recognition, then speech-to-text transcription, then answering the question, then text-to-speech generation). InferLine [15] automatically scales each stage in such a pipeline, assigns stages to appropriate hardware and tunes model batch sizes. Nexus [51] optimizes video processing pipelines by assigning models to GPUs and adapting batch sizes for parts of a model (instead of models as a whole). Skyscraper [33] optimizes video processing pipelines through buffering and cloud bursting techniques. The most fundamental and common difference between these works and CascadeServe is that these works optimize a user-specified ML pipeline whereas CascadeServe serves inferences by building cascades.

## 3 System overview

In the previous sections, we described how leveraging the potential of cascades in an inference-serving setting poses a unique set of challenges that prior work does not address. We now provide a high-level overview on how CascadeServe tackles these challenges.

**User-provided information.** In CascadeServe, users register their workload by providing (i) a set of trained models for building cascades (e.g., Llama2-7b, Llama2-13b, Llama2-70b [54]), (ii) a set of labeled samples for evaluating the performance of the model cascades (e.g., a public LLM benchmark [69]), and (iii) the users’ available hardware resources (e.g., number of GPUs, memory). Additionally, users can tailor CascadeServe’s service to their needs by specifying a Service-Level Objective (SLO). For latency-sensitive applications (e.g., recommender systems), users may set an SLO on latency, instructing CascadeServe to optimize accuracy without surpassing the latency target. Analogously, for accuracy-sensitive applications (e.g., code generation models), users may set an accuracy SLO, instucting CascadeServe to optimize latency while achieving the desired accuracy.

**Figure 2.** Processing times of BERT cascades when changing model placement and batch sizes.

**Figure 3.** Overview of CascadeServe.

**CascadeServe workflow.** Given the user’s inputs, CascadeServe optimizes its service by adaptively switching between cascades. Figure 2 shows that different cascades can incur significantly different processing times (i.e., latency). CascadeServe adapts its throughput by switching to fast cascades whenever the system load is high. For example, given the system configuration on the left (“original”), CascadeServe may use Cascade 1 to meet the required throughput whenever the system load is high. However, when the system load is low, a more accurate cascade may also fulfill the latency SLO, even if it is slower than Cascade 1.

The switching task is not straightforward because the latency/throughput depends not only on the cascade. To cope with high query loads, models within the cascade need to be replicated across GPUs. Model replication is not a trivial task since every GPU has a finite amount of memory (VRAM) that generally can not fit all models. Figure 2 shows how, after optimizing model placement, the processing times of cascades can dramatically change. Therefore, cascades must be tuned jointly with the placement of models on the hardware. Furthermore, in model serving systems, it is common to batch samples together and forward them through the ML model as one tensor. Larger batch sizes can significantly improve throughput by improving the utilization of the underlying hardware [16]. However, larger batch sizes also incur waiting time since inference is delayed until the batch is filled. Figure 2 shows how, after optimizing the batch sizes, Cascade 3 becomes the fastest cascade despite originally being the slowest. Therefore, CascadeServe must also consider and optimize for batching effects.

In summary, CascadeServe must optimize and carefully coordinate many interdependent moving pieces, which impose an exponential search space of possible options. Moreover, this optimization must incur a low overhead on the critical path of cascade inference.

CascadeServe tackles this problem by offloading most of the decision-making to an offline planning phase before serving users’ queries online. Specifically, CascadeServe generates a *gear plan* that determines how to serve inferences online when faced with different query loads. The gear plan further determines how models should be replicated across GPUs. CascadeServe uses a fixed allocation of models to GPUs throughout online serving, which allows it to quickly switch between cascades without having to wait for models to be loaded. Figure 3 summarizes the life cycle of CascadeServe: First, a gear plan is generated offline. Then, as the system is started, all models are loaded onto GPUs as specified by the gear plan. Finally, CascadeServe performs inferencing by simply switching between gears, allowing it to make near-optimal decisions at negligible runtime overhead.

**Gear plan generation.** CascadeServe generates a gear plan by decomposing the decision problem into four subproblems. First, the system must construct cascades from the given set of models (`SP1`). Different cascades vary in accuracy and throughput, and we want to identify a subset of cascades on the Pareto-optimal frontier. Second, the system must decide which cascades to use for each QPS range (`SP2`). Higher QPSes require cascades with higher throughput. Third, cascades must be distributed and replicated across the available hardware resources (`SP3`). High GPU utilization can only be achieved if different models are collocated onto the same GPU. However, GPU VRAM is a scarce resource, and different cascades must co-exist in VRAM. Fourth, the system must select a batch size for each model replica (`SP4`). Large batch sizes allow for improved throughput but incur higher latency since inference is delayed until a batch is filled.

Each of the four problems has an exponential search space. Furthermore, the subproblems are interdependent and, therefore, have to be optimized jointly. To do so, CascadeServe designs a novel Expectation-Maximization-based algorithm [41]. For each subproblem, CascadeServe introduces a submodule that optimizes the subproblem with respect to a fixed solution to all other subproblems. CascadeServe then alternately calls these submodules to derive a joint solution. During this process, the joint solution is iteratively improved by optimizing one subproblem at a time. Our algorithmic design of the submodules and iteration logic leads to a fast convergence, which we prove in Appendix A. We give a detailed description of the algorithm in Section 4.

**Gear plan operation.** CascadeServe uses a Producer-Consumer architecture [36] to serve inferences online. The producer measures the QPS by periodically counting the number of queries arriving over a fixed interval (e.g., 100ms). Then, it can quickly look up the optimal gear from the gear plan according to the QPS. The producer forwards requests to *inference server*, which contains a queue for each model in the cascade that buffers requests before inference. The producer places the requests into the queue of the first model in the gear’s cascade. Each queue is periodically polled by the *consumer*, which triggers inference if enough samples are queued according to the batch size in the current gear. This design is highly scalable because producers, consumers, and inference servers can be scaled independently to avoid bottlenecks. We give a detailed description of this architecture in Section 5.

## 4 Gear plan generation

The gear plan dictates how requests are served online. Specifically, the gear plan specifies the placement of models on users’ hardware devices and assigns a gear to each QPS range that indicates the model cascade and batch size to use for this range. Then, during online serving, CascadeServe measures the incoming QPS and switches between gears accordingly.

In the following, we describe how CascadeServe decomposes the complicated problem of searching for optimal gear plans into four simpler subproblems. Solving each subproblem individually is much more tractable than solving the original problem. More importantly, based on this CascadeServe, and the decomposition still allows us to jointly optimize the interdependent subproblems, which CascadeServe achieves via an iterative algorithm that is inspired by Expectation-Maximization [41] (EM). We describe this algorithm in Section 4.1. We then discuss the submodules that optimize the individual subproblems. By leveraging insights specific to cascades, each submodule is capable of finding a near-optimal solution to its subproblem.

### 4.1 Subproblem co-optimization

**Algorithm 1.** Gear plan optimization

```
 Inputs: SLO, model_profiles, qps_distribution
// Initial gear plan
gear_plan $\leftarrow$ init_plan(qps_distribution, model_profiles, SLO)
error_code $\leftarrow$ "ok"
subproblem_modules $\leftarrow$ [search_cascades, assign_cascades, place_models, tune_batch_sizes]
cur_subproblem $\leftarrow 0$
// Optimize one subproblem at a time keeping the others fixed
while not converged do
  if cur_subproblem == -1 then
   raise Error("infeasible")
  end if
  module $\leftarrow$ subproblem_modules[cur_subproblem]
  error_code, gear_plan $\leftarrow$ module(error_code, gear_plan)
  if error_code == "ok" then
              //Go to the next submodule and optimize
   cur_subproblem $\leftarrow$ (cur_subproblem + 1) % 4
  else
             //Go to the previous submodule and resolve the error
   cur_subproblem $\leftarrow$ cur_subproblem - 1
  end if
end while
```

As discussed previously, CascadeServe employs a submodule for each optimization subproblem. These submodules are iteratively optimized with respect to a fixed solution of the other subproblems. CascadeServe cycles through the submodules to derive a joint solution at convergence. Algorithm 1 shows pseudo-code for this procedure, and we put the proof of its convergence in Appendix A.

#### Iteration logic.

In line 3 of Algorithm 1, CascadeServe cycles through subproblems in the following order: (i) searching for cascades, (ii) assigning cascades to each QPS range, (iii) placing models onto hardware (including load balancing), and (iv) assigning a batch size of each model replica for each QPS range. We create one submodule to optimize one subproblem. Submodules throw an “infeasible” error when they cannot find a *feasible* gear plan, i.e., a gear plan that fulfills the SLO and ensures the resource capacities (e.g., the number of GPUs and memory) are not exceeded.

The motivation behind CascadeServe’s error-driven approach is that submodules need to make choices with respect to a fixed solution of all other subproblems. In CascadeServe, the submodules make optimistic decisions and assume that, even if their decisions might not produce a feasible gear plan, the other submodules can optimize their solutions to make the plan feasible. For example, when the workload adaption module (`SP2`) assigns cascades to QPS ranges, it needs to know how much throughput each cascade achieves, which may be further improved by the model placement module (`SP3`). Therefore, instead of missing out on an effective cascade that may become feasible after the optimizations of other submodules, the current submodule needs to consider currently infeasible cascades. An error will be thrown if the other submodules can not optimize the cascade further. In this case, the current submodule will backtrack this error and correct its previous solution. This error-driven approach ensures that each submodule will not miss the effective gear plan.

When a submodule throws an error (lines 13-14 in Algorithm 1), it is caught by the previous submodule in the sequence, which will try to adjust its solution based on the error code. If this is not possible, this submodule throws an error to the one before. This error resolution process continues recursively. If the error can’t be resolved at the first submodule, a final error will be raised to the user (lines 6-7), e.g., "impossible to meet the SLO given the provided hardware resource." Once all errors are resolved, CascadeServe keeps iterating until it converges (lines 11-12). In the following sections, we provide details on how each module optimizes the corresponding sub-problem, detects an error, and resolves it.

Our EM algorithm requires an initialization (line 1) on model placement (`SP3`) and batch sizes (`SP4`) to start the optimization of searching for cascades (`SP1`) and assigning cascades to QPS ranges (`SP2`). We trivially initialize the model placement so that each model is replicated across all GPUs, which may not be feasible. We initialize the batch sizes of all models to the minimum batch size of 1. This initialization generally applies to any workload, and we empirically verify that our algorithm performs well with this initialization.

### 4.2 Cascade search

Different cascades achieve different throughput and accuracy and only a subset of cascades is Pareto-optimal. The models and certainty thresholds used in a cascade directly determine its throughput and accuracy. In addition, the placement and batch size of each model also affect the throughput.

CascadeServe forms cascades from a family of models that the user registers (e.g., a set of Llama models or a set of BERT models). Each model is assumed to produce a *certainty*, indicating its prediction confidence. For example, for a model like Llama that outputs a probability distribution on the next possible token, the prediction certainty can be measured as the softmax of the predicted logits. We discretize the continuous range of possible certainty thresholds into selectable thresholds. In practical settings, the number of registered models is relatively small (e.g., there are 3 Llama-2 variants) and a small number of discretized thresholds is sufficient to ensure cascade diversity. This allows CascadeServe to use a simple approach for this submodule: we randomly sample cascades and thresholds and retain only the Pareto-optimal ones. To evaluate the throughput and accuracy of a cascades, CascadeServe uses a simulator. Compared to measuring the performance on a real workload, the simulator can evaluate a cascade at low cost. This allows the submodule to sample a large set of cascade, closely approximating the Pareto frontier.

It is a known result that inference serving systems can accurately be simulated [22, 39]. We describe and evaluate our simulator in Appendix C.

**Error handling.** It is worth noticing that this submodule always includes the cheapest cascade and the most accurate cascade. Receiving an error suggests that the other submodules have failed to attain the SLO, even when always using the cheapest cascade (in case of a latency SLO) or the most accurate cascade (in case of an accuracy SLO). In this case, the user’s SLO is unattainable on the user’s hardware and the submodule raises an error to the user.

### 4.3 Workload adaption

The output of the cascade search submodule (§4.2) is a set of cascades with their accuracies and throughputs. We now describe the submodule that decides which of these cascades to use under different query loads. Specifically, the user specifies the maximum QPS $qps_{max}$ that the system may encounter. This submodule then divides the spectrum of possible QPS from 0 to $qps_{max}$ into $n_{ranges}$ equal-sized QPS ranges and assigns a cascade to each range.

Intuitively, the submodule could simply assign cascades based on their accuracy and throughput as indicated by the cascade search submodule (`SP1`). However, while the accuracy of a cascade won’t change, its throughput might change significantly after other submodules optimize their subproblems to better support the chosen cascades. This naive approach therefore precludes the system from choosing cascades that have insufficient throughput with respect to the current placement and batch sizes but would achieve it after running the other submodules.

Instead, this submodule starts out by assigning the most performant cascade according to the non-SLO metric to each QPS range (i.e., the most accurate cascade if the SLO is on latency, or the cheapest cascade if the SLO is on accuracy). The submodule only corrects its choices once the other submodules indicate that they cannot fulfill the SLO given the current cascade assignment. Upon receiving an error, the submodule *downgrades* the cascade at the QPS range that the error specifies (e.g., if the user has set a latency SLO and this submodule receives an error that the latency SLO cannot be fulfilled for the QPS range of 100-200, the submodule assigns the next cheaper cascade to that QPS range).

If this submodule receives an `ok` code, it has already found a feasible assignment but might be able to improve it. Specifically, the cascade search module (`SP1`) may have output new cascades that allow for even better cascade assignments. For each QPS range, this submodule iterates through the new cascades and only swaps a new candidate cascade for the current one if the new cascade is better or equal in terms of both, accuracy and throughput.

### 4.4 Hardware mapping

We now describe the submodule that maps the workload to the underlying hardware. This involves replicating the models across devices (*model placement*) and determining what fraction of the workload each replica should serve (*load balancing*). The goal of this submodule is that for any QPS range, the assigned cascade can be run at the required throughput without loading models into GPU VRAM at runtime.

Note that we are placing models, not cascades, and different models inside a cascade might need to be placed onto different GPUs. Recall that the initial model placement is to replicate each model on every GPU. Although this placement allows for maximum throughput, it generally will not fit into the GPUs’ VRAM. Thus, the submodule designs a greedy pruning strategy that prunes the model placement until it doesn’t exceed the memory capacity of any GPU. A final set of models is selected based on their effectiveness at balancing load among GPUs.

**Load balancing.** This module finds the optimal assignment of QPS $q_{r}$ to model replicas $r$ given the cascade used to serve the load, the placement of models onto hardware, and the QPS $QPS_{m}$ that each model $m$ in the cascade needs to serve.^2 It assigns load to replicas using the following linear program with decision variables $q_{r}$.

$$
\displaystyle\,\sum_{r\in\mathcal{R}}q_{r} \displaystyle\textrm{with }q_{r}\geq 0 \tag{1}
$$

$$
\displaystyle\sum_{r\in\mathcal{R}[m]}q_{r}\geq QPS_{m} \displaystyle\forall m\in\textrm{cascade} \tag{2}
$$

$$
\displaystyle\sum_{r\in\mathcal{R}[d]}q_{r}*runtime(r)\leq u \displaystyle\forall d\in\textrm{devices} \tag{3}
$$

where $\mathcal{R}$ is the set of model replicas, and $\mathcal{R}[m]$ denote the replicas of model $m$ and $\mathcal{R}[d]$ denote the replicas on device $d$. $runtime(r)$ is the runtime per sample of replica $r\in\mathcal{R}$ with a default batch size of 1. Equation 1 ensures that the load balancer doesn’t assign more load than needed. Equation 2 ensures that that the replicas jointly serve the $QPS_{m}$ that is demanded by each model $m$ in the cascade. $u$ is a threshold on the maximum allowed GPU utilization. Equation 3 enforces that each GPU must have a utilization below $u$. The load balancer tries to find a load assignment that minimizes $u$ by first building a linear program with $u=100\%$. If the program is solvable, the load balancer builds further linear programs where $u$ is iteratively decreased until $u$ is so low that the program becomes unsolvable. The load balancer returns the minimum value of $u$ for which the program was solvable — this indicates the lowest GPU utilization that the given model placement allows for. If the program is unsolvable for $u=100\%$, this is indicated through an error.

**Model placement.** This submodule greedily prunes model replicas from devices until the replicas assigned to each device fit within that device’s memory. The utility of pruning a replica $r$ is determined by two factors. First, how much overallocated memory is freed by pruning it. Second, the replica’s importance for load balancing. The importance of a replica for load balancing is determined by calling the load balancer for every QPS with a cascade that uses replica $r$. The load balancer is called with a placement where $r$ is pruned and the maximum GPU utilization $u_{max}(r)$ over all QPS is taken. If $r$ is the last replica of a model (i.e., pruning $r$ makes a cascade unrunnable) or the load balancer throws an error, the utility $util(r)$ of pruning $r$ is set to $-\infty$.

Equation 4 shows the combined utility for pruning replica $r$, where $m_{over}(d)$ is the overallocated memory on device $d$ and $m_{freed}(r,d)$ is the memory that would be freed on device $d$ when pruning replica $r$. The submodule iteratively prunes the replica with the highest utility until no device’s memory capacity is exceeded. If no pruning utility is greater than zero, no placement can realize the given cascade, and this submodule throws an error.

$$
util(r)=\frac{\sum_{d\in\textrm{devices}}\max(\,0,m_{over}(d)-m_{freed}(d,r)\,)}{u_{max}(r)} \tag{4}
$$

**Error handling.** This submodule may receive an error from the batch size optimization submodule (`SP4`), if the required throughput cannot be achieved for a given QPS range. The error message will indicate the QPS range and the first model $m$ (e.g., Llama-70b) in the cascade where throughput was insufficient (i.e., $m$ is the bottleneck). To resolve the error, this submodule will try to improve $m$’s throughput by including an additional replica of $m$ in the model placement. This can be enforced by setting the utility of pruning $m$ to $-\infty$ for all replicas of $m$, once pruning a replica would violate the additional constraint. If no placement can fulfill this constraint, this submodule also throws an error.

### 4.5 Dynamic batching

We now describe how CascadeServe optimizes request batching. Larger batch sizes increase throughput but incur waiting times since samples wait in a queue until the batch is filled and inference is triggered. The optimal batch size depends on the QPS that are assigned to a model replica: At low QPS, it takes long to form large batches as model queues fill slowly. However, the model replica also needs to achieve lower throughput, making small batch sizes ideal. Analogously, high QPS mean that queues are fill quickly and more throughput is required, making large batch sizes suitable. To account of this, CascadeServe dynamically adapts the batch size of each model replica to its incoming QPS.

During online serving, samples are buffered for inference in a queue. CascadeServe triggers inference once a *minimum queue length* is reached. The value of this minimum queue length is optimized by this submodule. The optimal value is determined with respect to a QPS range and is stored in a gear.

For every QPS range, this submodule starts by setting the minimum queue length to 1 for all replicas of the first model in the cascade. The cascade will then be simulated using CascadeServe’s simulator (§C). When throughput is found to be insufficient, the submodule will increase the minimum queue length of the first mode in the cascade by 1. Since this means that larger batches will be formed, and more samples will be cascaded per batch, increasing the minimum queue length of the first model in the cascade also increases how many samples are included in each batch of the later models. This process repeats until the required throughput is met. The submodule will throw an error if the required throughput cannot be achieved by increasing the batch size (e.g., the wait time will be too long, or the large batch size will exceed memory).

Prior work [16] proposes a dynamic batching approach tailored to inference serving for a single model or bagging ensembles, which uses a *maximum batch size*. However, this approach induces large latencies in the setting of model cascades because it results in a high resource contention among different models in a cascade.

## 5 Gear plan operation

**Figure 4.** Online serving architecture.

We now describe how CascadeServe serves predictions online. We implemented a serving system that operates according to a gear plan. Given the gear plan, online serving becomes trivial, which allows for performant, scalabale and easily maintainable implementations. Our architecture follows the Producer-Consumer paradigm [36] and is depicted in Figure 4, where each grey box depicts a separate process. This architecture is highly scalable as there is no centralized component and consumers, producers, and inference servers can be scaled independently.

### Inference server.

An inference server hosts and runs the models. It manages a set of GPUs and loads the models accoring to the gear plan. For a maximum casade length of $\ell_{max}$, the server allocates $\ell_{max}$ memory regions in GPU VRAM to serve as model queues. An inference server may manage more than one GPU, for example, because a model may not fit into the memory of one GPU. In this case, our implementation runs each model in its own process — this allows models on disjoint sets of GPUs to run in parallel.

**Producer.** The producer takes user requests and puts them into the queue of the first model in the cascade. The producer decides which inference server to use based on the load balancing defined in the gear plan. The producer measures QPS periodically by counting the number of queries within the measurement period. Based on the measured QPS, the producer switches the gears of the inference servers.

When there is high QPS followed by low QPS, CascadeServe must avoid downgrading the gear while there are still many samples queued from the high QPS interval. When switching gears on an inference server, CascadeServe therefore also considers the queue length $Q_{0}$ of the first model on that server. Specifically, given the measured QPS $qps$, the gear is not changed if $qps<\alpha*Q_{0}$, where $\alpha$ is a tunable parameter. We find that $\alpha=8$ works well for most scenarios.

**Consumer.** The consumer periodically polls the queues on the inference server and triggers inference based on the batching mechanism described in §4.5.

## 6 Evaluation

In this section, we thoroughly evaluate CascadeServe to answer the following questions:

- §6.3 How does CascadeServe compare against baselines in terms of cost, latency and accuracy?
- §6.4 How does CascadeServe degrade performance based on the SLO?
- §6.5 How effective is CascadeServe’s gear plan optimization method?
- §6.6 How much do individual optimizations contribute to CascadeServe overall performance?

### 6.1 Workloads

A workload in our evaluation consists of (i) a set of models, (ii) a benchmark task to measure the predictive performance of the cascade, and (iii) a workload trace to emulate when queries are issued against the system. We evaluate CascadeServe on two workloads: one comprising a family of fast models (BERT) and one comprising a family of slow models (Llama).

**BERT.** We evaluate BERT [18] on the commonly used Sentiment-140 benchmark [21], which performs sentiment analysis on Tweets. We use BERT Tiny, BERT Mini, BERT Small, BERT Medium, and BERT Base models [56] to construct different model cascades. We use the pre-trained weights of these models and fine-tune them on a training set from this benchmark. We evaluate the performance of CascadeServe and other baselines by prompting the systems with samples from a held-out test set of the benchmark. Each system uses PyTorch [45] and the Huggingface Transformers package [60] to invoke the models.

The request pattern is derived from the time stamps at which the Tweets were posted, as done in prior works [48]. We remove all seconds with 0 QPS and take the first 20 minutes of the resulting trace for the experiments. To sufficiently stress the systems, we linearly scale the QPS for each second such that the maximum is 7600 QPS. For the experiment with the accuracy SLO of 81.5% in Figure 5, we scale the trace such that the maximum is 80,000 QPS. Without the scaling, the workloads would be trivial to run and performance differences in the systems would not be visible. The experiment with the low accuracy SLO needs to be scaled further since the systems use smaller models, which are sufficient to fulfill the SLO.

**Llama.** We use Llama-2 7b, Llama-2 13b, Llama-2 70b [54] as well as OpenLlama 3b [20]. For all models, we consider a 4-bit GPTQ-quantized version. We use ExLlama [55] to invoke the models. We evaluate the Llama models on the commonly used HellaSwag [69] benchmark.

We derive the workload pattern from an invocation trace of Microsoft Azure Functions [50], which is commonly used in other works as well [39, 71]. We randomly sample a 20 minute window from the trace and linearly scale the trace so it has a maximum of 60 QPS, and a maximum of 196 QPS for the experiment in Figure 6 with an accurcy SLO of 55%. Like for the BERT workload, the scaling is necessary to make it feasible to run the workload on our hardware resources while still sufficiently stressing the systems and making the workload non-trivial to run.

### 6.2 Experimental set up

#### Hardware.

We run the experiments on NVIDIA Tesla V-100 GPUs with 32 GB of VRAM. Our cluster provides limits us to a maximum of 16 concurrent GPUs , which is the reason for the workload scaling described in 6.1. The GPUs are distributed across 8 nodes, where each node has 2 GPUs that are connected over a PCIe bus.

**Implementation.** We implemented CascadeServe on top of Ray [42]. The producer and consumer are Ray actors and run in their own process. Inference servers are actors too and each inference server manages a set of GPUs exclusively. Requests are issued from a separate client process that runs in an open loop (i.e. issues requests without waiting for the result of previous requests).

In all experiments, CascadeServe estimates the certainty of the models using the output logits (§B). However, the certainty estimation method is not fundamental to our implementation and can easily be exchanged.

**Baselines.** We compare against three baselines.

First, we use a Dynamic Batching (DynBa) baseline. DynBa statically provisions GPUs and uses the same model for all inferences. It uses dynamic batching to optimize throughput and latency. We use a similar batching mechanism as used in CascadeServe because it delivered the best results when compared to alternatives.

Second, we compare against Cocktail [23]. Cocktail is a state-of-the-art academic system that uses bagging ensembles and autoscaling. Cocktail’s open-source implementation is tightly coupled to AWS, and we re-implemented it to run in our setup. Furthermore, we make the following improvements and denote the resulting system as *Cocktail+*: (i) Cocktail uses a forecasting model for autoscaling. Cocktail+ is provided with the groundtruth workload forecast to eliminate any error that the forecasting model might introduce. (ii) VMs may take dozens of seconds to boot before they are available. When Cocktail+ requests additional VMs, they are immediately available. After requesting the VM, Cocktail+ can immediately load the desired model into VRAM. We then perform one warmup inference in the background before samples are routed to the newly spawned instance because we found that this warmup greatly improves performance. (iii) We implement dynamic batching for Cocktail+ using CascadeServe’s mechanism.

Third, we compare against Model Switching (MS) [72]. MS switches between single models based on the measured QPS. MS is originally intended for inference on CPUs and assumes that all models can jointly fit into RAM. Model switching has no public implementation and we therefore implemented our own version. We call this version *MS+* and further enhance it: (i) MS+ runs on GPUs. (ii) While MS disables batching, we find that this leads to poor performance in MS+. Since MS+ is implemented on top of Clipper, we implement Clipper’s batching mechanism for MS+. (iii) In our benchmarks, not all models jointly fit into VRAM. To allow MS+ to run these benchmarks, we greedily collocate as many models into the VRAM of every GPU as possible. This aims to maximize replication and throughput.

### 6.3 End-to-end performance

**Figure 5.** End-to-end performance on the BERT workload.

We now compare CascadeServe’s performance to the baselines described in §6.2. We emulate the workload traces described in §6.1 and iterate through the samples in the test sets of the ML benchmarks — if we reach the end of the test set, we start from the beginning again. We perform an extensive grid search over the hyperparameter spaces of the baselines, and report the best hyperparameter combination found.

The performance of each system is measured in terms of cost (number of GPUs), latency, and accuracy. In Figures 5 and 6, we keep one of these three dimensions fixed and plot the trade-off between the other two. For every dimension, we use two different fixed values. Cocktail+ doesn’t support running on a fixed number of GPUs because it uses autoscaling. We therefore don’t report the performance of Cocktail+ in experiments where we fix the number of GPUs.

Figures 5 and 6 show that CascadeServe consistently outperforms the baselines for both workloads. For most SLOs, CascadeServe can achieve peak performance using 2-3$\times$ fewer GPUs than the best baseline. For a given number of GPUs, CascadeServe significantly dominates the baselines at all points on the accuracy-latency curve. The dynamic batching baseline severely underutilizes its GPUs most of the time because it has to provision for workload peaks to meet latency targets. Cocktail+ improves on this by autoscaling but because of long loading times of the models, we found that good performance can only be achieved if the periodicity of autoscaling is set to a relatively large interval. As a consequence of this coarse-grained autoscaling, Cocktail+ also underutilizes its GPUs. MS+ switches between models, which may occur at a high frequency. However, MS+ faces large performance cliffs, where slight changes in the workload may require the system to switch to a model with largely inferior accuracy . In comparison to these baselines, CascadeServe performs the best because it can make fine-grained adaptions to the workload while also avoiding large performance degradation. Furthermore, CascadeServe saves work by using cascades. We breakdown the impact of the two effects in §6.6.

Surprisingly, in the BERT workload, CascadeServe achieves a higher accuracy than the most expensive model (BERT Base). This is because the cheap models in the cascade correctly and confidently (i.e., with high certainty) classify some samples that the expensive models would have misclassified. Worth mentioning that overall, the cheap models have a lower accuracy than the expensive ones.

Figures 7(a) and 7(c) show the minimum number of GPUs that are required to achieve different points in the latency-accuracy space. Figures 7(b) and 7(d) derive from these results and show the cost savings that CascadeServe achieves when compared to the cheapest baseline at each cell. The figures show that CascadeServe can achieve most points in the accuracy-latency space using 2-3$\times$ fewer GPUs. For low accuracy regimes, the serving task becomes trivial, which is why the systems don’t show great performance differences on the given QPS trace.

**Figure 6.** End-to-end performance on the Llama workload.

**Figure 7.** Required number of GPUs to reach different accuracies and latencies. The cost savings compare CascadeServe to the cheapest baseline at each cell.

**(a).** GPUs required to reach different accuracies and latencies for BERT.

**(b).** Cost savings for BERT

**(c).** GPUs required to reach different accuracies and latencies for Llama.

**(d).** Cost savings for Llama

### 6.4 Performance degradation

When faced with high QPS, CascadeServe degrades accuracy and latency based on the SLO. Real-world workload patterns contain frequent and high variations in the query load. To examine the behaviour of CascadeServe and the baselines when faced with with spiky request patterns, we now examine their performance on a simplified trace.

In Figure 8, we run the BERT workload with an SLO on p95 latency of at most $400ms$. We provision MS+ with three GPUs and DynBa with four GPUs. Figure 8 shows two runs where CascadeServe is provisioned with one and two GPUs. In the following, we focus on analyzing the run where it is provisioned with one GPU. Cocktail+ autoscales the GPUs, and we trigger replanning at QPS changes or whenever latency stabilizes again after latency spikes. We provide Cocktail+ with the ground truth QPS that will be issued. Accuracies and latencies are measured over sliding windows. The SLO is shaded in green.

**Figure 8.** BERT performance degradation with latency SLO.

Figure 8 shows how DynBa’s large provisioning allows it to fulfill the latency SLO when the QPS is relatively low. However, even four GPUs are insufficient for DynBa to achieve the required throughput for the large peak. During the peak, DynBa’s p95 latency shoots up to almost $4s$. Cocktail+ automatically scales its provisioning. However, loading a model into VRAM and warming it up takes several seconds. This leaves Cocktail+ under-provisioned until the resources become available and throughput can be met. Cocktail+’s latency, therefore, shoots up at every QPS peak and stays stable at high levels as soon as throughput is met again. Alternatively, MS+ will choose cheaper models for these peaks to maintain the latency while significantly decreasing the accuracy. This allows MS+ to always fulfill the latency SLO. However, even though MS+ is provisioned with three times more GPUs than CascadeServe, its accuracy is worse than CascadeServe’s throughout the entire run. Finally, CascadeServe switches between model cascades and can fulfill the latency SLO with a minor accuracy degradation while using significantly fewer GPUs than any of the baselines.

**Figure 9.** Llama performance degradation with accuracy SLO.

Figure 9 runs the Llama workload with an accuracy SLO of 60%. Accuracies and latencies are measured over sliding windows and the SLO is shaded in green. MS+ is provisoined with eight GPUs, and DynBa with 16. We show two runs for CascadeServe, one with four GPUs and one with six. In the following, we focus on the run with four GPUs as it shows more clearly how CascadeServe degrades performance. Cocktail+ autoscales and we trigger autoscaling at QPS changes or whenever latency stabilizes again. We provide Cocktail+ with the groundtruth future QPS.

Figure 9 shows that DynBa has a static accuracy which fulfills the SLO. However, even though DynBa uses 16 GPUs, it cannot handle the second QPS spike and its latency dramatically increases. Similarly, Cocktail+’s accuracy always stays within the SLO but the large loading times of Llama models don’t allow it to adapt well to the workload peaks. Instead, every QPS peak leads to a large increase in latency. MS+ achieves a low latency throughout the run at the cost of accuracy. For the larger QPS peak, MS+ violates the accuracy SLO. CascadeServe also degrades accuracy but only if this doesn’t violate the SLO. After $500s$, we can see how CascadeServe chooses to sacrifice latency instead of accuracy in order to fulfill the SLO. Furthermore, even though MS+ is provisioned with twice as many GPUs, CascadeServe degrades accuracy significantly less than MS+.

### 6.5 Gear plan optimizer

**Figure 10.** Quality of plans found by gear planner.

**Figure 11.** Cost of offline planning.

We now evaluate the gear plan optimizer in terms of the quality of its plans and planning time. We evaluate all plans with respect to the metrics returned by the simulator (Appendix C) since the planner also operates with respect to these metrics when deployed.

Figure 10 compares the plans found by CascadeServe’s gear planner to exhaustive search and a random sampling baseline. To make an exhaustive search feasible, we only consider a highly constrained search space. Specifically, we assume that all models can jointly be placed onto each GPU (maximum replication), which is possible since we only evaluate the gear plans on a simulator. We further set all batch sizes to be 1. Finally, to shorten the simulation time, we use a short, 8-second workload trace that is inspired by the traces in Section 6.1. All methods operate on the same constrained search space. The exhaustive baseline tries all possible assignments of cascades to QPS ranges. The random sampling baseline randomly samples a cascade for each QPS range. The budget for random sampling is set to be 2$\times$ the runtime of CascadeServe’s planner.

CascadeServe’s planner runs for 0.1s (Llama) and 1s (BERT). The discrepancy in runtime mainly comes from the BERT workload using higher QPS, which causes higher runtimes of the simulator since more work needs to be simulated. The exhaustive search runs for 9min (Llama) and 16min (BERT). Compared to the exhaustive search, CascadeServe’s planner misses some plans along the latency-accuracy Pareto frontier but closely approximates the Pareto-frontier. Compared to the random sampling baseline, CascadeServe finds significantly better plans.

Figure 11 evaluates the runtime of the gear planner. Here we use the full search spaces of the Llama and BERT workloads. The planning time is most sensitive to the number of QPS ranges $n_{ranges}$ that the plan should distinguish among (§4.3). We show the total number of submodule calls and the wallclock runtime for both workloads and denote the $n_{ranges}$ used in our experiment through the vertical line. We can see that for realistic values, the offline planning time is reasonable. For example, for our experiments, each planning completed within a few minutes. Even if the user chooses to use a larger number for $n_{ranges}$, the planning time is reasonable, given that this is a one-off, offline procedure.

### 6.6 Ablation study

**Figure 12.** Performance when disabling optimizations.

Finally, we examine what the drivers of CascadeServe’s performance are in Figure fig:ablation. *No Switching* uses a static cascade to serve inferences and *No cascade* switches between single models. The performance of No cascade and MS+ might differ because they use different batching mechanisms. We run the workloads as described in Section 6.1. Figure 12 shows that both optimizations significantly contribute to the final performance.

## 7 Conclusion

Efficient inference serving in ML is complicated by two challenges. First, ML models incur high computational cost, and, second, the arrival rates of many practical applications have high and unpredictable variations. In this paper we showed that model cascades are able tackle both of these challenges, as they save work while maintaining accuracy, and expose a high-resolution trade-off between work and accuracy.

We described CascadeServe, which addresses several challenges of model serving with cascades, including workload adaption, model replication onto hardware, and request batching. CascadeServe operates in an offline and online phase. In the offline phase, the system pre-computes a *gear plan* that specifies how to serve inferences online. We find that CascadeServe saves $2-3\times$ in cost across a wide spectrum of the latency-accuracy space when compared to state-of-the-art baselines on different workloads.

## Appendix A Gear planner convergence proof

In this section we prove that the gear plan optimization algorithm described in Section 4 always returns. The argument is analogous to convergence proofs for Expectation-Maximization algorithms [41]. We distinguish between two cases.

### Case 1: The algorithm never finds a feasible plan.

The planner will keep iterating through the submodules and the submodules will always throw an error whenever they are called. This causes the workload adaption submodule (`SP2`) to downgrade a cascade in each iteration (i.e., if the SLO is on accuracy, it will use more accurate cascade, and if the SLO is on latency, it will use a cascade with more throughput). This process can only be repeated until there is no QPS whose cascade can further be downgraded. At that point, the module will also throw an error and the cascade search submodule (`SP1`) will raise an error to the user. The algorithm has terminated.

### Case 2: The algorithm finds a feasible plan at some point.

Once the algorithm finds a feasible plan, it will never produce an infeasible plan again. This is insured by each submodule, which only updates the gear plan if this update improves the plan while making sure it remains feasible. This also means that in each iteration of the algorithm, the gear plan only becomes better (in terms of the non-SLO metric) or stays the same. If the plan stays the same for one entire iteration through all submodules, the algorithm terminates. It is guaranteed that such an iteration eventually occurs, since the gear plan cannot be improved indefinitely: The latency cannot go below $0ms$ and the prediction quality cannot go beyond perfect predictions (e.g. 100% accuracy).

## Appendix B Certainty estmation

The method for certainty estimation is not fundamental to CascadeServe and can be replaced with other methods, e.g., methods proposed in other works [59]. For our experiments, we found that the following method works well and used it in all of the experiments.

Many ML tasks involve assigning scores to options. For example, recommender systems assign scores to objects, classifiers assign scores to classes, text generation models assign scores to tokens, etc. To estimate certainty, we simply take the score of the highest scoring entity and subtract the score of the second-highest scoring entity. High differences mean that the model is clear about what the highest scoring entity is — this corresponds to a high prediction certainty. Low differences mean that it is contested which entity scores highest (e.g. which class the input belongs to) — this corresponds to low prediction certainties.

Equation 5 denotes the certainty of model $model$ on input $x$. $model(x)^{(1)}$ is the entity with the highest score and $model(x)^{(2)}$ the entity with the second highest score (e.g., the most likely class and the second most likely class according to the model).

$$
cert(model,x)=model(x)^{(1)}-model(x)^{(2)} \tag{5}
$$

## Appendix C Simulator

CascadeServe uses a simulator to evaluate cascades and gear plans during the offline phase. It is a known results that model serving systems can accurately be simulated [39, 22]. In CascadeServe, this simulator is used to drastically improve the runtime of gear plan generation.

### C.1 Latency simulation

**Figure 13.** Relative error in p95 latency simulation for 15 gear plans.. Positive errors mean the latency was over-estimated, negative errors mean the latency was under-estimated.

We describe how an individual cascade is simulated for a given QPS. Simulating different cascades at different QPSes follows trivially by continuing the simulation while not resetting the simulation state from the previous QPS.

In a first step, CascadeServe profiles all models that the user registered with different batch sizes. CascadeServe further lets every model predict on the validation data used in the simulation, and records its prediction and certainty.

In a nutshell, CascadeServe’s simulator closely mirrors what the system does when actually running. The gear is periodically switched in the simulation, as it is in real runs. As queries are issued, samples are put in the queue of the first model of the cascade specified in the current gear. The queue lengths of all models are polled with every query being added. Once a queue length reaches the minimum batch size defined in the gear, its inference is triggered, pending on the simulated GPU becoming available. Once the GPU is available, inference is simulated on all samples in the queue by reading out the profiled runtime of the model for the given queue size. During that runtime, the GPU is blocked and other inferences may not be scheduled on it.

For runtime estimation, the simulator simply uses the certainties and runtimes of the samples in the validation set and cycles through them. The simulator cascades a subset of the samples in a batch based on the pre-recorded prediction certainties and the certainty threshold set in the gear.

We evaluate the simulator in Figure 13. Each bar in the chart corresponds to a gear plan, whose p95 latency was simulated and then compared to the runtime of an actual run. Figure 13 reports the percentage difference between the two latencies. Figure 13 shows 15 different gear plans, on three different workload traces and for two different models (BERT and Llama).

### C.2 Accuracy simulation

We now describe how CascadeServe simulates accuracy. CascadeServe uses these accuracy estimates to make decisions on which models and which cascades to use for online serving. Deciding on which models to use based on the model’s offline performance on validation data is a common practice, which is also employed by other serving systems [48, 23]. Nevertheless, the offline accuracy measurement may differ from what users experience online, which is a related to monitoring ML services, a problem addressed in literature orthogonal to this work [49]. CascadeServe can only estimate the online accuracy when making strong assumptions about the workload.

The accuracy of a cascade is determined by predicting all validation data using the cascade and computing the accuracy using the user-provided, ground truth labels. The accuracy of a gear plan is determined as the time-weighted average of all cascades being used in the gear plan. Most time intervals in real-world workloads typically comprise of a low QPS, with occasional workload spikes [50]. Prior work in related areas has found that the load distributions of real-world workloads typically follow a Zipf-like distribution [10]. This has inspired works of many domains to model their workload as a Zipfian [17, 31, 34, 67, 66]. In CascadeServe, the simulator also assumes per default that the QPS distribution is Zipfian — that is, when the gear planner needs to choose a QPS interval for downgrading, it will assess the cascades’ impact on the overall accuracy while considering that low-QPS regimes occur more frequently than high-QPS regimes. During online serving, CascadeServe measures the QPS in any case as an artifact of gear switching. If the system finds that the actual QPS distribution strongly deviates from the expected one, it will notify the user. The user may then choose whether they want to keep the current gear plan or trigger re-planning with a more accurate qPS distribution (e.g., the one that CascadeServe measured).

If the user sets an SLO on latency, the gear planner will ensure that the latency target is obeyed for any QPS. This means that the Zipfian assumption does not have an effect on SLO attainment but might have an effect on the optimality of the plan if the online distribution strongly deviates from a Zipfian. In this case the gear planner might have deprioritized the wrong cascades for downgrading.

If the user sets an SLO on accuracy, the gear planner will attempt to meet this SLO for the assumed Zipfian distribution. Specifically the gear planner will assign accurate cascades to low-QPS regimes and assume that these cascades are used for longer time periods than the less accurate cascades assigned to high-QPS regimes. To avoid SLO violations online, CascadeServe scales the maps the measured QPS distribution onto the distribution used in the gear plan — this is realized by scaling each measured QPS value by a linear factor, such that measured QPS distribution after scaling matches the one of the gear plan. Like for the latency SLO, the Zipfian assumtion does therefore not lead to SLO violations but may lead to suboptimal gear plans if the assumed distribution strongly deviates from the one found online. In the most extreme scenario, the gear plan might be scaled such that it degenerates to always using the most expensive cascade.

## Footnotes

- **1** With 4-bit GPTQ-quantization [19] and a prompt length of 40 tokens.
- **2** $QPS_{m}$ is determined through the fraction of samples that the cascade forwards to each model on a validation set, multiplied by the total QPS.

## References

- [1] AWS SageMAker. <https://aws.amazon.com/sagemaker/> (Accessed on 24 Mar 2024).
- [2] AzureML model serving. <https://learn.microsoft.com/en-us/azure/machine-learning/tutorial-deploy-model?view=azureml-api-2> (Accessed on 23 Jan 2024).
- [3] Databricks Model Serving. <https://docs.databricks.com/en/machine-learning/model-serving/index.html> (Accessed on 21 Jan 2024).
- [4] Databricks Model Serving. <https://docs.databricks.com/en/machine-learning/model-serving/index.html> (Accessed on 24 Mar 2024).
- [5] NVIDIA Triton Inference Server. <https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/index.html> (Accessed on 24 Mar 2024).
- [6] TensorFlow Serving. [www.tensorflow.org/serving](https://www.tensorflow.org/serving) (Accessed on 24 Mar 2024).
- [7] TorchServe. <https://pytorch.org/serve/> (Accessed on 21 Jan 2024).
- [8] Ali, A., Pinciroli, R., Yan, F., and Smirni, E. Batch: Machine learning inference serving on serverless platforms with adaptive batching. In *SC20: International Conference for High Performance Computing, Networking, Storage and Analysis* (2020), pp. 1–15.
- [9] Bahri, Y., Dyer, E., Kaplan, J., Lee, J., and Sharma, U. Explaining neural scaling laws, 2021.
- [10] Breslau, L., Cao, P., Fan, L., Phillips, G., and Shenker, S. Web caching and zipf-like distributions: evidence and implications. In *IEEE INFOCOM ’99. Conference on Computer Communications. Proceedings. Eighteenth Annual Joint Conference of the IEEE Computer and Communications Societies. The Future is Now (Cat. No.99CH36320)* (1999), vol. 1, pp. 126–134 vol.1.
- [11] Cai, H., Gan, C., Wang, T., Zhang, Z., and Han, S. Once-for-all: Train one network and specialize it for efficient deployment. In *International Conference on Learning Representations* (2020).
- [12] Chen, L., Zaharia, M., and Zou, J. Frugalgpt: How to use large language models while reducing cost and improving performance, 2023.
- [13] Chen, L., Zaharia, M., and Zou, J. Y. Frugalml: How to use ml prediction apis more accurately and cheaply. In *Advances in Neural Information Processing Systems* (2020), H. Larochelle, M. Ranzato, R. Hadsell, M. Balcan, and H. Lin, Eds., vol. 33, Curran Associates, Inc., pp. 10685–10696.
- [14] Choi, S., Lee, S., Kim, Y., Park, J., Kwon, Y., and Huh, J. Serving heterogeneous machine learning models on Multi-GPU servers with Spatio-Temporal sharing. In *2022 USENIX Annual Technical Conference (USENIX ATC 22)* (Carlsbad, CA, July 2022), USENIX Association, pp. 199–216.
- [15] Crankshaw, D., Sela, G.-E., Mo, X., Zumar, C., Stoica, I., Gonzalez, J., and Tumanov, A. Inferline: latency-aware provisioning and scaling for prediction serving pipelines. In *Proceedings of the 11th ACM Symposium on Cloud Computing* (New York, NY, USA, 2020), SoCC ’20, Association for Computing Machinery, pp. 477–491.
- [16] Crankshaw, D., Wang, X., Zhou, G., Franklin, M. J., Gonzalez, J. E., and Stoica, I. Clipper: a low-latency online prediction serving system. In *Proceedings of the 14th USENIX Conference on Networked Systems Design and Implementation* (USA, 2017), NSDI’17, USENIX Association, pp. 613–627.
- [17] Cunha, C., Bestavros, A., and Crovella, M. Characteristics of www client-based traces. Tech. rep., USA, 1995.
- [18] Devlin, J., Chang, M.-W., Lee, K., and Toutanova, K. BERT: Pre-training of deep bidirectional transformers for language understanding. In *Proceedings of the 2019 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies, Volume 1 (Long and Short Papers)* (Minneapolis, Minnesota, June 2019), J. Burstein, C. Doran, and T. Solorio, Eds., Association for Computational Linguistics, pp. 4171–4186.
- [19] Frantar, E., Ashkboos, S., Hoefler, T., and Alistarh, D. GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers, 2023.
- [20] Geng, X., and Liu, H. Openllama: An open reproduction of llama, May 2023.
- [21] Go, A., Bhayani, R., and Huang, L. Twitter sentiment classification using distant supervision. CS224N Project Report 1(2009), Stanford University, 2009.
- [22] Gujarati, A., Karimi, R., Alzayat, S., Hao, W., Kaufmann, A., Vigfusson, Y., and Mace, J. Serving DNNs like clockwork: Performance predictability from the bottom up. In *14th USENIX Symposium on Operating Systems Design and Implementation (OSDI 20)* (Nov. 2020), USENIX Association, pp. 443–462.
- [23] Gunasekaran, J. R., Mishra, C. S., Thinakaran, P., Sharma, B., Kandemir, M. T., and Das, C. R. Cocktail: A multidimensional optimization for model serving in cloud. In *19th USENIX Symposium on Networked Systems Design and Implementation (NSDI 22)* (Renton, WA, Apr. 2022), USENIX Association, pp. 1041–1057.
- [24] Gupta, N., Narasimhan, H., Jitkrittum, W., Rawat, A. S., Menon, A. K., and Kumar, S. Language model cascades: Token-level uncertainty and beyond. In *The Twelfth International Conference on Learning Representations* (2024).
- [25] Han, M., Zhang, H., Chen, R., and Chen, H. Microsecond-scale preemption for concurrent GPU-accelerated DNN inferences. In *16th USENIX Symposium on Operating Systems Design and Implementation (OSDI 22)* (Carlsbad, CA, July 2022), USENIX Association, pp. 539–558.
- [26] Hong, S., Xu, Y., Khare, A., Priambada, S., Maher, K., Aljiffry, A., Sun, J., and Tumanov, A. Holmes: Health online model ensemble serving for deep learning models in intensive care units. In *Proceedings of the 26th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining* (New York, NY, USA, 2020), KDD ’20, Association for Computing Machinery, p. 1614–1624.
- [27] Jain, P., Mo, X., Jain, A., Subbaraj, H., Durrani, R. S., Tumanov, A., Gonzalez, J., and Stoica, I. Dynamic space-time scheduling for gpu inference. In *32nd Conference on Neural Information Processing Systems (NeurIPS 2018)* (Montreal, Canada, 2018).
- [28] Jeong, J., Baek, S., and Ahn, J. Fast and efficient model serving using multi-gpus with direct-host-access. In *Proceedings of the Eighteenth European Conference on Computer Systems* (New York, NY, USA, 2023), EuroSys ’23, Association for Computing Machinery, pp. 249–265.
- [29] Kang, D., Emmons, J., Abuzaid, F., Bailis, P., and Zaharia, M. Noscope: optimizing neural network queries over video at scale. *Proc. VLDB Endow. 10*, 11 (aug 2017), 1586–1597.
- [30] Kaplan, J., McCandlish, S., Henighan, T., Brown, T. B., Chess, B., Child, R., Gray, S., Radford, A., Wu, J., and Amodei, D. Scaling laws for neural language models, 2020.
- [31] Kavalanekar, S., Worthington, B., Zhang, Q., and Sharda, V. Characterization of storage workload traces from production windows servers. In *2008 IEEE International Symposium on Workload Characterization* (2008), pp. 119–128.
- [32] Khare, A., Garg, D., Kalra, S., Grandhi, S., Stoica, I., and Tumanov, A. Superserve: Fine-grained inference serving for unpredictable workloads, 2023.
- [33] Kossmann, F., Wu, Z., Lai, E., Tatbul, N., Cao, L., Kraska, T., and Madden, S. Extract-transform-load for video streams. *Proc. VLDB Endow. 16*, 9 (may 2023), 2302–2315.
- [34] Kotera, I., Egawa, R., Takizawa, H., and Kobayashi, H. Modeling of cache access behavior based on zipf’s law. In *Proceedings of the 9th Workshop on MEmory Performance: DEaling with Applications, Systems and Architecture* (New York, NY, USA, 2008), MEDEA ’08, Association for Computing Machinery, p. 9–15.
- [35] Kraft, P., Kang, D., Narayanan, D., Palkar, S., Bailis, P., and Zaharia, M. Willump: A statistically-aware end-to-end optimizer for machine learning inference. In *Proceedings of Machine Learning and Systems* (2020), I. Dhillon, D. Papailiopoulos, and V. Sze, Eds., vol. 2, pp. 147–159.
- [36] Lamport, L. Proving the correctness of multiprocess programs. *IEEE Transactions on Software Engineering SE-3*, 2 (1977), 125–143.
- [37] Lebovitz, L., Cavigelli, L., Magno, M., and Muller, L. K. Efficient inference with model cascades. *Transactions on Machine Learning Research* (2023).
- [38] Lee, Y., Scolari, A., Chun, B.-G., Santambrogio, M. D., Weimer, M., and Interlandi, M. PRETZEL: Opening the black box of machine learning prediction serving systems. In *13th USENIX Symposium on Operating Systems Design and Implementation (OSDI 18)* (Carlsbad, CA, Oct. 2018), USENIX Association, pp. 611–626.
- [39] Li, Z., Zheng, L., Zhong, Y., Liu, V., Sheng, Y., Jin, X., Huang, Y., Chen, Z., Zhang, H., Gonzalez, J. E., and Stoica, I. AlpaServe: Statistical multiplexing with model parallelism for deep learning serving. In *17th USENIX Symposium on Operating Systems Design and Implementation (OSDI 23)* (Boston, MA, July 2023), USENIX Association, pp. 663–679.
- [40] Lu, T., Wang, H., Shao, H., Gao, J., and Yao, H. $c^{3}$: Confidence calibration model cascade for inference-efficient cross-lingual natural language understanding, 2024.
- [41] Moon, T. The expectation-maximization algorithm. *IEEE Signal Processing Magazine 13*, 6 (1996), 47–60.
- [42] Moritz, P., Nishihara, R., Wang, S., Tumanov, A., Liaw, R., Liang, E., Elibol, M., Yang, Z., Paul, W., Jordan, M. I., and Stoica, I. Ray: a distributed framework for emerging ai applications. In *Proceedings of the 13th USENIX Conference on Operating Systems Design and Implementation* (USA, 2018), OSDI’18, USENIX Association, p. 561–577.
- [43] Ng, K. K. W., Demoulin, H. M., and Liu, V. Paella: Low-latency model serving with software-defined gpu scheduling. In *Proceedings of the 29th Symposium on Operating Systems Principles* (New York, NY, USA, 2023), SOSP ’23, Association for Computing Machinery, pp. 595–610.
- [44] Nie, L., Ding, Z., Hu, E., Jermaine, C., and Chaudhuri, S. Online cascade learning for efficient inference over streams, 2024.
- [45] Paszke, A., Gross, S., Massa, F., Lerer, A., Bradbury, J., Chanan, G., Killeen, T., Lin, Z., Gimelshein, N., Antiga, L., Desmaison, A., Köpf, A., Yang, E., DeVito, Z., Raison, M., Tejani, A., Chilamkurthy, S., Steiner, B., Fang, L., Bai, J., and Chintala, S. *PyTorch: an imperative style, high-performance deep learning library*. Curran Associates Inc., Red Hook, NY, USA, 2019.
- [46] Rebelo, M. Â., Coelho, D., Pereira, I., and Fernandes, F. A new cascade-hybrid recommender system approach for the retail market. In *Innovations in Bio-Inspired Computing and Applications* (Cham, 2022), A. Abraham, A. M. Madureira, A. Kaklauskas, N. Gandhi, A. Bajaj, A. K. Muda, D. Kriksciuniene, and J. C. Ferreira, Eds., Springer International Publishing, pp. 371–380.
- [47] Redmon, J., Divvala, S., Girshick, R., and Farhadi, A. You only look once: Unified, real-time object detection. In *2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)* (Los Alamitos, CA, USA, jun 2016), IEEE Computer Society, pp. 779–788.
- [48] Romero, F., Li, Q., Yadwadkar, N. J., and Kozyrakis, C. INFaaS: Automated model-less inference serving. In *2021 USENIX Annual Technical Conference (USENIX ATC 21)* (July 2021), USENIX Association, pp. 397–411.
- [49] Schröder, T., and Schulz, M. Monitoring machine learning models: a categorization of challenges and methods. *Data Science and Management 5*, 3 (2022), 105–116.
- [50] Shahrad, M., Fonseca, R., Goiri, I., Chaudhry, G., Batum, P., Cooke, J., Laureano, E., Tresness, C., Russinovich, M., and Bianchini, R. Serverless in the wild: Characterizing and optimizing the serverless workload at a large cloud provider. In *2020 USENIX Annual Technical Conference (USENIX ATC 20)* (July 2020), USENIX Association, pp. 205–218.
- [51] Shen, H., Chen, L., Jin, Y., Zhao, L., Kong, B., Philipose, M., Krishnamurthy, A., and Sundaram, R. Nexus: a gpu cluster engine for accelerating dnn-based video analysis. In *Proceedings of the 27th ACM Symposium on Operating Systems Principles* (New York, NY, USA, 2019), SOSP ’19, Association for Computing Machinery, pp. 322–337.
- [52] Shen, H., Han, S., Philipose, M., and Krishnamurthy, A. Fast video classification via adaptive cascading of deep models. In *2017 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)* (2017), pp. 2197–2205.
- [53] Strati, F., Ma, X., and Klimovic, A. Orion: Interference-aware, fine-grained gpu sharing for ml applications. In *Nineteenth European Conference on Computer Systems (EuroSys ’24)* (Athens, Greece, April 22–25 2024), ACM, pp. 1–18.
- [54] Touvron, H., Martin, L., Stone, K., Albert, P., Almahairi, A., Babaei, Y., Bashlykov, N., Batra, S., Bhargava, P., Bhosale, S., Bikel, D., Blecher, L., Ferrer, C. C., Chen, M., Cucurull, G., Esiobu, D., Fernandes, J., Fu, J., Fu, W., Fuller, B., Gao, C., Goswami, V., Goyal, N., Hartshorn, A., Hosseini, S., Hou, R., Inan, H., Kardas, M., Kerkez, V., Khabsa, M., Kloumann, I., Korenev, A., Koura, P. S., Lachaux, M.-A., Lavril, T., Lee, J., Liskovich, D., Lu, Y., Mao, Y., Martinet, X., Mihaylov, T., Mishra, P., Molybog, I., Nie, Y., Poulton, A., Reizenstein, J., Rungta, R., Saladi, K., Schelten, A., Silva, R., Smith, E. M., Subramanian, R., Tan, X. E., Tang, B., Taylor, R., Williams, A., Kuan, J. X., Xu, P., Yan, Z., Zarov, I., Zhang, Y., Fan, A., Kambadur, M., Narang, S., Rodriguez, A., Stojnic, R., Edunov, S., and Scialom, T. Llama 2: Open foundation and fine-tuned chat models, 2023.
- [55] turboderp. Exllama github repository. <https://github.com/turboderp/exllama>, 2024.
- [56] Turc, I., Chang, M.-W., Lee, K., and Toutanova, K. Well-read students learn better: On the importance of pre-training compact models, 2019.
- [57] Viola, P., and Jones, M. Rapid object detection using a boosted cascade of simple features. In *Proceedings of the 2001 IEEE Computer Society Conference on Computer Vision and Pattern Recognition. CVPR 2001* (2001), vol. 1, pp. I–I.
- [58] Wang, W., Gao, J., Zhang, M., Wang, S., Chen, G., Ng, T. K., Ooi, B. C., Shao, J., and Reyad, M. Rafiki: machine learning as an analytics service system. *Proc. VLDB Endow. 12*, 2 (oct 2018), 128–140.
- [59] Wang, X., Luo, Y., Crankshaw, D., Tumanov, A., Yu, F., and Gonzalez, J. E. Idk cascades: Fast deep learning by learning not to overthink, 2018.
- [60] Wolf, T., Debut, L., Sanh, V., Chaumond, J., Delangue, C., Moi, A., Cistac, P., Rault, T., Louf, R., Funtowicz, M., Davison, J., Shleifer, S., von Platen, P., Ma, C., Jernite, Y., Plu, J., Xu, C., Scao, T. L., Gugger, S., Drame, M., Lhoest, Q., and Rush, A. M. Huggingface’s transformers: State-of-the-art natural language processing, 2020.
- [61] Wu, C.-J., Raghavendra, R., Gupta, U., Acun, B., Ardalani, N., Maeng, K., Chang, G., Aga, F., Huang, J., Bai, C., Gschwind, M., Gupta, A., Ott, M., Melnikov, A., Candido, S., Brooks, D., Chauhan, G., Lee, B., Lee, H.-H., Akyildiz, B., Balandat, M., Spisak, J., Jain, R., Rabbat, M., and Hazelwood, K. Sustainable ai: Environmental implications, challenges and opportunities. In *Proceedings of Machine Learning and Systems* (2022), D. Marculescu, Y. Chi, and C. Wu, Eds., vol. 4, pp. 795–813.
- [62] Wu, X., Xu, H., and Wang, Y. Irina: Accelerating dnn inference with efficient online scheduling. In *Proceedings of the 4th Asia-Pacific Workshop on Networking* (New York, NY, USA, 2020), APNet ’20, Association for Computing Machinery, pp. 36–43.
- [63] Wu, Z., Marcus, R., Liu, Z., Negi, P., Nathan, V., Pfeil, P., Saxena, G., Rahman, M., Narayanaswamy, B., and Kraska, T. Stage: Query execution time prediction in amazon redshift, 2024.
- [64] X Engineering Blog. Resilient ad serving at twitter-scale, March 2016. <https://blog.x.com/engineering/en_us/a/2016/resilient-ad-serving-at-twitter-scale> (accessed on May 7, 2024).
- [65] Xu, Y., Khare, A., Matlin, G., Ramadoss, M., Kamaleswaran, R., Zhang, C., and Tumanov, A. Unfoldml: Cost-aware and uncertainty-based dynamic 2d prediction for multi-stage classification, 2022.
- [66] Yang, Y., and Zhu, J. Write skew and zipf distribution: Evidence and implications. *ACM Trans. Storage 12*, 4 (jun 2016).
- [67] Yu, H., Zheng, D., Zhao, B. Y., and Zheng, W. Understanding user behavior in large-scale video-on-demand systems. In *Proceedings of the 1st ACM SIGOPS/EuroSys European Conference on Computer Systems 2006* (New York, NY, USA, 2006), EuroSys ’06, Association for Computing Machinery, p. 333–344.
- [68] Yu, P., and Chowdhury, M. Salus: Fine-grained gpu sharing primitives for deep learning applications, 2019.
- [69] Zellers, R., Holtzman, A., Bisk, Y., Farhadi, A., and Choi, Y. HellaSwag: Can a machine really finish your sentence? In *Proceedings of the 57th Annual Meeting of the Association for Computational Linguistics* (Florence, Italy, July 2019), A. Korhonen, D. Traum, and L. Màrquez, Eds., Association for Computational Linguistics, pp. 4791–4800.
- [70] Zhang, C., Yu, M., Wang, W., and Yan, F. MArk: Exploiting cloud services for Cost-Effective, SLO-Aware machine learning inference serving. In *2019 USENIX Annual Technical Conference (USENIX ATC 19)* (Renton, WA, July 2019), USENIX Association, pp. 1049–1062.
- [71] Zhang, H., Tang, Y., Khandelwal, A., and Stoica, I. SHEPHERD: Serving DNNs in the wild. In *20th USENIX Symposium on Networked Systems Design and Implementation (NSDI 23)* (Boston, MA, Apr. 2023), USENIX Association, pp. 787–808.
- [72] Zhang, J., Elnikety, S., Zarar, S., Gupta, A., and Garg, S. Model-Switching: Dealing with fluctuating workloads in Machine-Learning-as-a-Service systems. In *12th USENIX Workshop on Hot Topics in Cloud Computing (HotCloud 20)* (July 2020), USENIX Association.
